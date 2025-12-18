import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { draftOrders, orders, orderEvents, orderPayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { completeDraftOrderFromWebhook } from "@/app/[locale]/actions/draft-orders";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata) {
      console.error("Missing metadata in checkout session");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // Handle both draftId (invoice payments) and orderId (regular orders)
    const draftId = metadata.draftId;
    const orderId = metadata.orderId;

    if (!draftId && !orderId) {
      console.error("Missing both draftId and orderId in metadata");
      return NextResponse.json(
        { error: "Missing draftId or orderId" },
        { status: 400 }
      );
    }

    try {
      // Get payment intent to calculate fees
      const paymentIntentId = session.payment_intent as string;
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      // Calculate amounts
      const totalAmount = (paymentIntent.amount / 100).toFixed(2);
      const applicationFeeAmount = paymentIntent.application_fee_amount
        ? (paymentIntent.application_fee_amount / 100).toFixed(2)
        : "0";
      const netAmountToStore = (
        (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) /
        100
      ).toFixed(2);

      let finalOrderId: string;
      let currency: string;

      if (draftId) {
        // Handle invoice payment (draft order)
        const draftData = await db
          .select({
            id: draftOrders.id,
            currency: draftOrders.currency,
            totalAmount: draftOrders.totalAmount,
          })
          .from(draftOrders)
          .where(eq(draftOrders.id, draftId))
          .limit(1);

        if (draftData.length === 0) {
          console.error("Draft order not found:", draftId);
          return NextResponse.json(
            { error: "Draft order not found" },
            { status: 404 }
          );
        }

        const draft = draftData[0];
        currency = draft.currency;

        // Complete the draft order (convert to order)
        const completeResult = await completeDraftOrderFromWebhook(draftId, true); // markAsPaid = true

        if (!completeResult.success) {
          console.error("Failed to complete draft order:", completeResult.error);
          return NextResponse.json(
            { error: "Failed to complete order" },
            { status: 500 }
          );
        }

        finalOrderId = completeResult.orderId!;
      } else if (orderId) {
        // Handle regular order payment
        const orderData = await db
          .select({
            id: orders.id,
            currency: orders.currency,
            paymentStatus: orders.paymentStatus,
          })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (orderData.length === 0) {
          console.error("Order not found:", orderId);
          return NextResponse.json(
            { error: "Order not found" },
            { status: 404 }
          );
        }

        const order = orderData[0];
        currency = order.currency;
        finalOrderId = order.id;

        // Update order payment status
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            paidAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else {
        return NextResponse.json(
          { error: "Invalid metadata" },
          { status: 400 }
        );
      }

      // Create payment record
      await db.insert(orderPayments).values({
        orderId: finalOrderId,
        amount: totalAmount,
        currency: currency,
        provider: "stripe",
        providerPaymentId: paymentIntentId,
        platformFeeAmount: applicationFeeAmount,
        netAmountToStore: netAmountToStore,
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionId: session.id,
        status: "completed",
      });

      // Create order event (createdBy is null for webhook events)
      await db.insert(orderEvents).values({
        orderId: finalOrderId,
        type: "payment",
        visibility: "internal",
        message: `Payment received via Stripe (${totalAmount} ${currency})`,
        createdBy: null,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: session.id,
          platformFee: applicationFeeAmount,
          netAmountToStore: netAmountToStore,
        } as Record<string, unknown>,
      });

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
