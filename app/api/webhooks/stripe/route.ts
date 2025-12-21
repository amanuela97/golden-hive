import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  draftOrders,
  orders,
  orderEvents,
  orderPayments,
  orderRefunds,
  orderItems,
  store,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { completeDraftOrderFromWebhook } from "@/app/[locale]/actions/draft-orders";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  console.log("=== WEBHOOK RECEIVED ===");
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    console.error("❌ No signature in webhook request");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log("✅ Webhook signature verified");
    console.log("📦 Event type:", event.type);
    console.log("📦 Event ID:", event.id);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    console.log("🛒 Processing checkout.session.completed event");
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Retrieve the full session from Stripe API to ensure we have all metadata
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["payment_intent"],
      });

      const metadata = fullSession.metadata || {};

      console.log("📋 Session metadata:", JSON.stringify(metadata, null, 2));
      console.log("📋 Session ID:", fullSession.id);
      console.log("📋 Payment Intent (raw):", fullSession.payment_intent);
      console.log("📋 Payment Intent type:", typeof fullSession.payment_intent);

      // Check if this is a multi-store checkout
      let isMultiStore = metadata.multiStore === "true";
      let storeBreakdown: Record<string, { stripeAccountId: string; amount: number; orderIds: string[] }> | null = null;
      let orderIdsArray: string[] = [];

      if (isMultiStore && metadata.storeBreakdown) {
        try {
          storeBreakdown = JSON.parse(metadata.storeBreakdown);
          if (metadata.orderIds) {
            orderIdsArray = JSON.parse(metadata.orderIds);
          }
        } catch (e) {
          console.error("Failed to parse store breakdown:", e);
        }
      }

      // Get payment intent ID - we need it for both single and multi-store
      let paymentIntentId: string | null = null;
      let paymentIntent: Stripe.PaymentIntent | null = null;

      if (fullSession.payment_intent) {
        paymentIntentId =
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : fullSession.payment_intent.id;
      } else {
        console.error("❌ Payment intent not found in session");
        return NextResponse.json(
          { error: "Payment intent not found" },
          { status: 400 }
        );
      }

      // Retrieve payment intent to get latest_charge and metadata
      console.log("📋 Retrieving payment intent:", paymentIntentId);
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Get metadata from payment intent if not in session metadata
      let draftId = metadata.draftId;
      let orderId = metadata.orderId;

      if (!draftId && !orderId) {
        draftId = paymentIntent.metadata?.draftId || metadata.draftId;
        orderId = paymentIntent.metadata?.orderId || metadata.orderId;
      }

      // Get multi-store data from payment intent if not in session metadata
      if (!isMultiStore && paymentIntent.metadata?.multiStore === "true") {
        isMultiStore = true;
        if (paymentIntent.metadata.storeBreakdown) {
          try {
            storeBreakdown = JSON.parse(paymentIntent.metadata.storeBreakdown);
            if (paymentIntent.metadata.orderIds) {
              orderIdsArray = JSON.parse(paymentIntent.metadata.orderIds);
            }
          } catch (e) {
            console.error("Failed to parse store breakdown from payment intent:", e);
          }
        }
      }

      console.log("📋 Payment Intent metadata:", JSON.stringify(paymentIntent.metadata, null, 2));
      console.log("🔍 Draft ID:", draftId);
      console.log("🔍 Order ID:", orderId);
      console.log("🔍 Is Multi-Store:", isMultiStore);
      console.log("🔍 Store Breakdown:", storeBreakdown ? "Present" : "Missing");

      // For multi-store checkout, we don't need draftId or orderId
      // Skip the validation if it's a multi-store checkout
      if (!isMultiStore && !draftId && !orderId) {
        console.error("❌ Missing both draftId and orderId in metadata");
        return NextResponse.json(
          { error: "Missing draftId or orderId" },
          { status: 400 }
        );
      }

      // Handle multi-store transfers FIRST (before processing individual orders)
      if (isMultiStore && storeBreakdown) {
        if (!paymentIntent.latest_charge) {
          console.error("❌ Payment intent does not have latest_charge yet");
          return NextResponse.json(
            { error: "Payment not yet captured" },
            { status: 400 }
          );
        }

        console.log("🏪 Processing multi-store transfers...");
        const chargeId = typeof paymentIntent.latest_charge === "string" 
          ? paymentIntent.latest_charge 
          : paymentIntent.latest_charge.id;
        
        console.log("💰 Charge ID:", chargeId);
        console.log("💰 Store breakdown:", JSON.stringify(storeBreakdown, null, 2));

        for (const [storeId, storeInfo] of Object.entries(storeBreakdown)) {
          const storeAmountCents = storeInfo.amount;
          const platformFeeCents = Math.round(storeAmountCents * 0.05); // 5% platform fee
          const payoutAmountCents = storeAmountCents - platformFeeCents;

          console.log(`💰 Transferring to store ${storeId}:`, {
            storeAmount: (storeAmountCents / 100).toFixed(2),
            platformFee: (platformFeeCents / 100).toFixed(2),
            payoutAmount: (payoutAmountCents / 100).toFixed(2),
          });

          try {
            // Create transfer to store's connected account
            const transfer = await stripe.transfers.create({
              amount: payoutAmountCents,
              currency: paymentIntent.currency,
              destination: storeInfo.stripeAccountId,
              source_transaction: chargeId,
              metadata: {
                orderIds: JSON.stringify(storeInfo.orderIds),
                storeId: storeId,
              },
            });

            console.log(`✅ Transfer created for store ${storeId}:`, transfer.id);

            // Create payment records and update order status for each order in this store
            for (const orderId of storeInfo.orderIds) {
              const orderData = await db
                .select({
                  id: orders.id,
                  totalAmount: orders.totalAmount,
                  currency: orders.currency,
                  fulfillmentStatus: orders.fulfillmentStatus,
                  status: orders.status,
                })
                .from(orders)
                .where(eq(orders.id, orderId))
                .limit(1);

              if (orderData.length === 0) {
                console.error(`❌ Order not found: ${orderId}`);
                continue;
              }

              const order = orderData[0];
              const orderAmount = parseFloat(order.totalAmount || "0");
              const orderPlatformFee = orderAmount * 0.05;
              const orderNetAmount = orderAmount - orderPlatformFee;

              // Create payment record
              await db.insert(orderPayments).values({
                orderId: orderId,
                amount: orderAmount.toFixed(2),
                currency: order.currency,
                provider: "stripe",
                providerPaymentId: paymentIntentId,
                platformFeeAmount: orderPlatformFee.toFixed(2),
                netAmountToStore: orderNetAmount.toFixed(2),
                stripePaymentIntentId: paymentIntentId,
                stripeCheckoutSessionId: session.id,
                status: "completed",
              });

              // Update order payment status and check if order should be completed
              const isFulfilled =
                order.fulfillmentStatus === "fulfilled" || order.fulfillmentStatus === "partial";

              let newOrderStatus = order.status;
              if (isFulfilled) {
                newOrderStatus = "completed";
                console.log(
                  `[Webhook] Order ${orderId} is paid and fulfilled, setting status to completed`
                );
              }

              await db
                .update(orders)
                .set({
                  paymentStatus: "paid",
                  paidAt: new Date(),
                  status: newOrderStatus,
                })
                .where(eq(orders.id, orderId));

              // Create order event for each order
              await db.insert(orderEvents).values({
                orderId: orderId,
                type: "payment",
                message: `Payment received via Stripe (multi-store checkout)`,
                visibility: "internal",
                metadata: {
                  paymentIntentId: paymentIntentId,
                  transferId: transfer.id,
                },
                createdBy: null, // Webhook event
              });
            }
          } catch (transferError) {
            console.error(`❌ Failed to transfer to store ${storeId}:`, transferError);
            // Continue with other stores even if one fails
          }
        }

        console.log("✅ Multi-store transfers completed");
        return NextResponse.json({ received: true });
      }

      // Single order flow (existing logic)
      // Calculate amounts
      const totalAmount = (paymentIntent.amount / 100).toFixed(2);
      const applicationFeeAmount = paymentIntent.application_fee_amount
        ? (paymentIntent.application_fee_amount / 100).toFixed(2)
        : "0";
      const netAmountToStore = (
        (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) /
        100
      ).toFixed(2);

      console.log("💰 Payment amounts:", {
        totalAmount,
        applicationFeeAmount,
        netAmountToStore,
      });

      let finalOrderId: string;
      let currency: string;

      if (draftId) {
        console.log("📝 Processing draft order payment:", draftId);
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
          console.error("❌ Draft order not found:", draftId);
          return NextResponse.json(
            { error: "Draft order not found" },
            { status: 404 }
          );
        }

        const draft = draftData[0];
        currency = draft.currency;
        console.log("✅ Draft order found:", {
          id: draft.id,
          currency: draft.currency,
          totalAmount: draft.totalAmount,
        });

        // Complete the draft order (convert to order)
        console.log("🔄 Completing draft order...");
        const completeResult = await completeDraftOrderFromWebhook(
          draftId,
          true
        ); // markAsPaid = true

        if (!completeResult.success) {
          console.error(
            "❌ Failed to complete draft order:",
            completeResult.error
          );
          return NextResponse.json(
            { error: "Failed to complete order" },
            { status: 500 }
          );
        }

        finalOrderId = completeResult.orderId!;
        console.log("✅ Draft order completed! Order ID:", finalOrderId);
        console.log("✅ Order Number:", completeResult.orderNumber);
      } else if (orderId) {
        console.log("📦 Processing regular order payment:", orderId);
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
          console.error("❌ Order not found:", orderId);
          return NextResponse.json(
            { error: "Order not found" },
            { status: 404 }
          );
        }

        const order = orderData[0];
        currency = order.currency;
        finalOrderId = order.id;
        console.log("✅ Order found:", {
          id: order.id,
          currency: order.currency,
          paymentStatus: order.paymentStatus,
        });

        // Update order payment status and check if order should be completed
        console.log("🔄 Updating order payment status to 'paid'...");

        // Get fulfillment status to determine if order should be completed
        const orderFulfillmentData = await db
          .select({
            fulfillmentStatus: orders.fulfillmentStatus,
            status: orders.status,
          })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        const fulfillmentStatus =
          orderFulfillmentData.length > 0
            ? orderFulfillmentData[0].fulfillmentStatus
            : null;
        const currentStatus =
          orderFulfillmentData.length > 0
            ? orderFulfillmentData[0].status
            : "open";

        const isFulfilled =
          fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partial";

        // If paid and fulfilled → "completed"
        let newOrderStatus = currentStatus;
        if (isFulfilled) {
          newOrderStatus = "completed";
          console.log(
            `[Webhook] Order ${orderId} is paid and fulfilled, setting status to completed`
          );
        }

        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            paidAt: new Date(),
            status: newOrderStatus,
          })
          .where(eq(orders.id, orderId));
        console.log("✅ Order payment status updated");
      } else {
        return NextResponse.json(
          { error: "Invalid metadata" },
          { status: 400 }
        );
      }

      // Create payment record (single store)
      console.log("💾 Creating payment record...");
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
      console.log("✅ Payment record created");

      // Create order event (createdBy is null for webhook events)
      console.log("📝 Creating order event...");
      await db.insert(orderEvents).values({
        orderId: finalOrderId,
        type: "payment",
        message: `Payment received via Stripe Checkout (Session: ${session.id})`,
        visibility: "internal",
        metadata: {
          paymentIntentId: paymentIntentId,
          checkoutSessionId: session.id,
        },
        createdBy: null, // Webhook event
      });
      console.log("✅ Order event created");

      // Send confirmation email (placeholder for now)
      console.log("📧 Confirmation email would be sent here");

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("❌ Error processing checkout.session.completed:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to process checkout session",
        },
        { status: 500 }
      );
    }
  }

  // Handle refund.updated event
  if (event.type === "refund.updated") {
    console.log("💸 Processing refund.updated event");
    const refund = event.data.object as Stripe.Refund;

    try {
      // Find the payment intent associated with this refund
      const paymentIntentId = refund.payment_intent as string;
      if (!paymentIntentId) {
        console.error("❌ No payment intent found in refund");
        return NextResponse.json(
          { error: "No payment intent found" },
          { status: 400 }
        );
      }

      // Find the order payment record
      const paymentRecord = await db
        .select()
        .from(orderPayments)
        .where(eq(orderPayments.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      if (paymentRecord.length === 0) {
        console.error("❌ Payment record not found for refund");
        return NextResponse.json(
          { error: "Payment record not found" },
          { status: 404 }
        );
      }

      const payment = paymentRecord[0];

      // Get all succeeded refunds for this payment intent
      const refunds = await stripe.refunds.list({
        payment_intent: paymentIntentId,
      });

      const succeededRefunds = refunds.data.filter(
        (r) => r.status === "succeeded"
      );
      const totalRefundedAmount = succeededRefunds.reduce(
        (sum, r) => sum + r.amount,
        0
      );

      // Update payment record with total refunded amount
      await db
        .update(orderPayments)
        .set({
          refundedAmount: (totalRefundedAmount / 100).toFixed(2),
          status:
            totalRefundedAmount === 0
              ? "completed"
              : totalRefundedAmount >= parseFloat(payment.amount) * 100
              ? "refunded"
              : "partially_refunded",
        })
        .where(eq(orderPayments.id, payment.id));

      // Recalculate order payment status
      const { recalculateOrderPaymentStatus } = await import(
        "@/app/[locale]/actions/orders"
      );
      await recalculateOrderPaymentStatus(payment.orderId);

      console.log("✅ Refund processed successfully");
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("❌ Error processing refund.updated:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to process refund",
        },
        { status: 500 }
      );
    }
  }

  // Handle other event types
  console.log(`⚠️ Unhandled event type: ${event.type}`);
  return NextResponse.json({ received: true });
}
