import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  draftOrders,
  orders,
  orderEvents,
  orderPayments,
  orderItems,
  store,
} from "@/db/schema";
import { eq } from "drizzle-orm";
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
      console.log("�� Session ID:", fullSession.id);
      console.log("📋 Payment Intent (raw):", fullSession.payment_intent);
      console.log("📋 Payment Intent type:", typeof fullSession.payment_intent);

      // If session metadata is empty, try to get metadata from payment intent
      let draftId = metadata.draftId;
      let orderId = metadata.orderId;

      if (!draftId && !orderId && fullSession.payment_intent) {
        const paymentIntentId =
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : fullSession.payment_intent.id;

        console.log(
          "🔍 Trying to get metadata from payment intent:",
          paymentIntentId
        );
        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);
        draftId = paymentIntent.metadata?.draftId || metadata.draftId;
        orderId = paymentIntent.metadata?.orderId || metadata.orderId;

        console.log(
          "📋 Payment Intent metadata:",
          JSON.stringify(paymentIntent.metadata, null, 2)
        );
      }

      console.log("🔍 Draft ID:", draftId);
      console.log("🔍 Order ID:", orderId);

      if (!draftId && !orderId) {
        console.error("❌ Missing both draftId and orderId in metadata");
        return NextResponse.json(
          { error: "Missing draftId or orderId" },
          { status: 400 }
        );
      }

      // Get payment intent to calculate fees
      let paymentIntentId: string;

      if (fullSession.payment_intent) {
        paymentIntentId =
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : fullSession.payment_intent.id;
      } else {
        // Try to get payment intent from the session's payment_intent field
        // Sometimes it's not expanded, so we need to retrieve it separately
        console.log(
          "⚠️ Payment intent not in expanded session, retrieving from session object"
        );
        if (session.payment_intent) {
          paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent.id;
        } else {
          console.error(
            "❌ Missing payment intent ID in both fullSession and session"
          );
          return NextResponse.json(
            { error: "Missing payment intent ID" },
            { status: 400 }
          );
        }
      }

      console.log("�� Retrieving payment intent:", paymentIntentId);
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

        // Update order payment status
        console.log("🔄 Updating order payment status to 'paid'...");
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            paidAt: new Date(),
          })
          .where(eq(orders.id, orderId));
        console.log("✅ Order payment status updated");
      } else {
        return NextResponse.json(
          { error: "Invalid metadata" },
          { status: 400 }
        );
      }

      // Create payment record
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
      console.log("✅ Order event created");

      // Send order confirmation email to customer
      console.log("📧 Sending order confirmation email...");
      try {
        const resend = (await import("@/lib/resend")).default;
        const OrderConfirmationEmail = (
          await import("@/app/[locale]/components/order-confirmation-email")
        ).default;

        // Get order details for email
        const orderData = await db
          .select({
            orderNumber: orders.orderNumber,
            customerEmail: orders.customerEmail,
            customerFirstName: orders.customerFirstName,
            customerLastName: orders.customerLastName,
            currency: orders.currency,
            subtotalAmount: orders.subtotalAmount,
            discountAmount: orders.discountAmount,
            shippingAmount: orders.shippingAmount,
            taxAmount: orders.taxAmount,
            totalAmount: orders.totalAmount,
            placedAt: orders.placedAt,
            shippingName: orders.shippingName,
            shippingAddressLine1: orders.shippingAddressLine1,
            shippingAddressLine2: orders.shippingAddressLine2,
            shippingCity: orders.shippingCity,
            shippingRegion: orders.shippingRegion,
            shippingPostalCode: orders.shippingPostalCode,
            shippingCountry: orders.shippingCountry,
          })
          .from(orders)
          .where(eq(orders.id, finalOrderId))
          .limit(1);

        if (orderData.length > 0) {
          const order = orderData[0];

          // Get order items
          const orderItemsData = await db
            .select({
              title: orderItems.title,
              quantity: orderItems.quantity,
              unitPrice: orderItems.unitPrice,
              lineTotal: orderItems.lineTotal,
              sku: orderItems.sku,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, finalOrderId));

          if (order.customerEmail) {
            const customerName =
              order.customerFirstName && order.customerLastName
                ? `${order.customerFirstName} ${order.customerLastName}`
                : order.customerEmail || "Customer";

            const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${finalOrderId}`;

            // Use configured from address or fallback to default
            const fromAddress =
              process.env.RESEND_FROM_EMAIL ||
              "Golden Hive <goldenhive@resend.dev>";

            console.log(
              `[Email] Sending confirmation email to ${order.customerEmail} for order #${order.orderNumber}`
            );

            const emailResult = await resend.emails.send({
              from: fromAddress,
              to: order.customerEmail,
              subject: `Order Confirmation #${order.orderNumber}`,
              react: OrderConfirmationEmail({
                orderNumber: Number(order.orderNumber),
                customerName,
                customerEmail: order.customerEmail,
                items: orderItemsData.map((item) => ({
                  title: item.title,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal || "0",
                  sku: item.sku || null,
                })),
                subtotal: order.subtotalAmount,
                discount: order.discountAmount || "0",
                shipping: order.shippingAmount || "0",
                tax: order.taxAmount || "0",
                total: order.totalAmount,
                currency: order.currency,
                paymentStatus: "paid",
                orderStatus: "open",
                shippingAddress:
                  order.shippingAddressLine1 ||
                  order.shippingCity ||
                  order.shippingCountry
                    ? {
                        name: order.shippingName || null,
                        line1: order.shippingAddressLine1 || null,
                        line2: order.shippingAddressLine2 || null,
                        city: order.shippingCity || null,
                        region: order.shippingRegion || null,
                        postalCode: order.shippingPostalCode || null,
                        country: order.shippingCountry || null,
                      }
                    : null,
                orderUrl,
              }),
            });

            if (emailResult.error) {
              // Provide more helpful error message for Resend domain verification issues
              const errorMessage = emailResult.error.message || "Unknown error";
              let userFriendlyError = `Failed to send email: ${errorMessage}`;

              if (
                errorMessage.includes("testing emails") ||
                errorMessage.includes("verify a domain")
              ) {
                userFriendlyError = `Email sending is limited in testing mode. To send confirmation emails to customers, please verify your domain at https://resend.com/domains. Current error: ${errorMessage}`;
              }

              console.error("❌ Resend API error:", emailResult.error);
              console.error(`[Email] ${userFriendlyError}`);
              // Don't throw - just log the error so webhook doesn't fail
              // The email will be sent once domain is verified
            } else {
              console.log(
                `✅ Order confirmation email sent successfully to ${order.customerEmail} (Email ID: ${emailResult.data?.id || "unknown"})`
              );
            }
          } else {
            console.log(
              "⚠️ No customer email found, skipping confirmation email"
            );
          }
        } else {
          console.log("⚠️ Order not found for confirmation email");
        }
      } catch (emailError) {
        // Log error but don't fail the webhook
        console.error(
          "❌ Failed to send order confirmation email:",
          emailError
        );
        if (emailError instanceof Error) {
          console.error(`[Email] Error message: ${emailError.message}`);
          console.error(`[Email] Error stack: ${emailError.stack}`);
        }
      }

      // Generate invoice PDF for the order (after payment)
      console.log("📄 Generating invoice PDF for order...");
      try {
        const { generateInvoiceForOrder } = await import(
          "@/app/[locale]/actions/invoice"
        );
        console.log(
          `[Invoice] Starting invoice generation for order ${finalOrderId}`
        );
        const invoiceResult = await generateInvoiceForOrder(finalOrderId);
        if (invoiceResult.success && invoiceResult) {
          console.log(
            `[Invoice] ✅ Invoice PDF generated successfully: ${invoiceResult.invoicePdfUrl}, ${invoiceResult.invoicePublicId}`
          );
          console.log(
            `[Invoice] Invoice Number: ${invoiceResult.invoiceNumber}`
          );
        } else {
          console.error(
            `[Invoice] ❌ Failed to generate invoice PDF:`,
            invoiceResult.error
          );
        }
      } catch (invoiceError) {
        console.error(
          `[Invoice] ❌ Exception during invoice PDF generation:`,
          invoiceError
        );
        if (invoiceError instanceof Error) {
          console.error(`[Invoice] Error message: ${invoiceError.message}`);
          console.error(`[Invoice] Error stack: ${invoiceError.stack}`);
        }
      }

      console.log("🎉 Webhook processing completed successfully!");
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      console.error(
        "❌ Error stack:",
        error instanceof Error ? error.stack : "No stack"
      );
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 }
      );
    }
  }

  // Handle account.updated event to update store Stripe status
  if (event.type === "account.updated") {
    console.log("🏪 Processing account.updated event");
    const account = event.data.object as Stripe.Account;

    try {
      // Find store by stripeAccountId
      const storeData = await db
        .select({
          id: store.id,
        })
        .from(store)
        .where(eq(store.stripeAccountId, account.id))
        .limit(1);

      if (storeData.length > 0) {
        // Update store with current Stripe account status
        await db
          .update(store)
          .set({
            stripeChargesEnabled: account.charges_enabled || false,
            stripePayoutsEnabled: account.payouts_enabled || false,
            stripeOnboardingComplete:
              account.details_submitted &&
              account.charges_enabled &&
              account.payouts_enabled,
            updatedAt: new Date(),
          })
          .where(eq(store.id, storeData[0].id));

        console.log("Updated store Stripe status:", {
          storeId: storeData[0].id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
        });
      }
    } catch (error) {
      console.error("Error updating store Stripe status:", error);
      // Don't fail the webhook - just log the error
    }

    return NextResponse.json({ received: true });
  }

  console.log("⚠️ Unhandled event type:", event.type);
  return NextResponse.json({ received: true });
}
