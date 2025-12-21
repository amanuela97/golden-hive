import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { draftOrders, draftOrderItems, store, listing, listingVariants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getDraftOrderByToken } from "@/app/[locale]/actions/invoice-payment";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    // Get draft order by token
    const draftResult = await getDraftOrderByToken(token);
    if (!draftResult.success || !draftResult.data) {
      return NextResponse.json(
        { error: draftResult.error || "Invoice not found" },
        { status: 404 }
      );
    }

    const draft = draftResult.data;

    // Get store with Stripe account ID
    if (!draft.storeId) {
      return NextResponse.json(
        { error: "Store not found for this invoice" },
        { status: 400 }
      );
    }

    const storeData = await db
      .select({
        id: store.id,
        stripeAccountId: store.stripeAccountId,
        storeName: store.storeName,
      })
      .from(store)
      .where(eq(store.id, draft.storeId))
      .limit(1);

    if (storeData.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const storeInfo = storeData[0];

    if (!storeInfo.stripeAccountId) {
      return NextResponse.json(
        {
          error: "Store has not connected Stripe account. Please contact support.",
        },
        { status: 400 }
      );
    }

    // Get draft items with product images and names for Stripe Checkout
    const draftItems = await db
      .select({
        title: draftOrderItems.title,
        quantity: draftOrderItems.quantity,
        unitPrice: draftOrderItems.unitPrice,
        lineTotal: draftOrderItems.lineTotal,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
        listingName: listing.name,
        variantTitle: listingVariants.title,
      })
      .from(draftOrderItems)
      .leftJoin(listing, eq(draftOrderItems.listingId, listing.id))
      .leftJoin(listingVariants, eq(draftOrderItems.variantId, listingVariants.id))
      .where(eq(draftOrderItems.draftOrderId, draft.id));

    // Calculate amounts (convert to cents)
    const totalAmountCents = Math.round(parseFloat(draft.totalAmount) * 100);
    const platformFeeCents = Math.round(totalAmountCents * 0.05); // 5% platform fee

    // Create line items for each product with images
    const lineItems = draftItems.map((item) => {
      const unitPriceCents = Math.round(parseFloat(item.unitPrice) * 100);
      const imageUrl = item.variantImageUrl || item.listingImageUrl || null;
      const productName = item.listingName || item.title;
      const displayName = item.variantTitle 
        ? `${productName} - ${item.variantTitle}`
        : productName;

      return {
        price_data: {
          currency: draft.currency.toLowerCase(),
          unit_amount: unitPriceCents,
          product_data: {
            name: displayName,
            description: item.title,
            ...(imageUrl && { images: [imageUrl] }),
          },
        },
        quantity: item.quantity,
      };
    });

    // Create Stripe Checkout Session with Connect (Destination Charges)
    // IMPORTANT: Create on platform account (not connected account) so webhooks come to our endpoint
    console.log("Creating Stripe Checkout Session for draft:", draft.id);
    console.log("Store Stripe Account ID:", storeInfo.stripeAccountId);
    console.log("Metadata to include:", {
      draftId: draft.id,
      storeId: storeInfo.id,
      invoiceToken: token,
    });
    
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: platformFeeCents, // Your 5% platform fee
        on_behalf_of: storeInfo.stripeAccountId, // Compliance & reporting
        transfer_data: {
          destination: storeInfo.stripeAccountId, // Store receives the rest
        },
        metadata: {
          draftId: draft.id,
          storeId: storeInfo.id,
          invoiceToken: token,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${token}?canceled=true`,
      customer_email: draft.customerEmail || undefined,
      metadata: {
        draftId: draft.id,
        storeId: storeInfo.id,
        invoiceToken: token,
      },
    });

    console.log("✅ Checkout session created:", {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      metadata: checkoutSession.metadata,
      paymentIntent: checkoutSession.payment_intent,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      checkoutUrl: checkoutSession.url || undefined,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}

