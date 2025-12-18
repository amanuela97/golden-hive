import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { draftOrders, draftOrderItems, store } from "@/db/schema";
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

    // Calculate amounts (convert to cents)
    const totalAmountCents = Math.round(parseFloat(draft.totalAmount) * 100);
    const platformFeeCents = Math.round(totalAmountCents * 0.05); // 5% platform fee

    // Create Stripe Checkout Session with Connect (Destination Charges)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: draft.currency.toLowerCase(),
            unit_amount: totalAmountCents,
            product_data: {
              name: `Invoice #${draft.draftNumber}`,
              description: `Payment for draft order #${draft.draftNumber}`,
            },
          },
          quantity: 1,
        },
      ],
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

