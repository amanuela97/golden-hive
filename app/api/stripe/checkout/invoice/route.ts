import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { store } from "@/db/schema";
import { eq } from "drizzle-orm";
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
          error:
            "Store has not connected Stripe account. Please contact support.",
        },
        { status: 400 }
      );
    }

    // Calculate amounts (convert to cents)
    // IMPORTANT: Use the draft.totalAmount which already includes discounts
    // Don't recalculate from line items as that would charge the full price
    const totalAmountCents = Math.round(parseFloat(draft.totalAmount) * 100);
    const platformFeeCents = Math.round(totalAmountCents * 0.05); // 5% platform fee

    // Create a single line item with the total amount (which already includes discount)
    // This ensures the customer pays the discounted price, not the full price
    const lineItems = [
      {
        price_data: {
          currency: draft.currency.toLowerCase(),
          unit_amount: totalAmountCents,
          product_data: {
            name: `Invoice #${draft.draftNumber} - Payment`,
            description: `Payment for invoice #${draft.draftNumber}${parseFloat(draft.discountAmount) > 0 ? ` (Discount applied: -${draft.discountAmount} ${draft.currency})` : ""}`,
          },
        },
        quantity: 1,
      },
    ];

    // Create Stripe Checkout Session
    // IMPORTANT: Payment goes to platform account (no destination charges)
    // Funds will be held and transferred later via payout feature
    console.log("Creating Stripe Checkout Session for draft:", draft.id);
    console.log("Store ID:", storeInfo.id);
    console.log("Metadata to include:", {
      draftId: draft.id,
      storeId: storeInfo.id,
      invoiceToken: token,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      // No payment_intent_data with transfer_data - payment goes to platform
      // Funds will be held and seller balance will be updated via webhook
      metadata: {
        draftId: draft.id,
        storeId: storeInfo.id,
        invoiceToken: token,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${token}?canceled=true`,
      customer_email: draft.customerEmail || undefined,
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
