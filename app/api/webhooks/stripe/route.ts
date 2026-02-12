import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  draftOrders,
  orders,
  orderEvents,
  orderPayments,
  orderItems,
  listing,
  store,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { completeDraftOrderFromWebhook } from "@/app/[locale]/actions/draft-orders";
import Stripe from "stripe";

/**
 * Helper function to send order confirmation email
 */
async function sendOrderConfirmationEmail(
  primaryOrderId: string,
  sessionId: string,
  allOrderIds?: string[]
): Promise<void> {
  try {
    const resend = (await import("@/lib/resend")).default;
    const OrderConfirmationEmail = (
      await import("@/app/[locale]/components/order-confirmation-email")
    ).default;

    // Fetch primary order data
    const primaryOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, primaryOrderId))
      .limit(1);

    if (primaryOrder.length === 0) {
      console.error(`Order not found: ${primaryOrderId}`);
      return;
    }

    const order = primaryOrder[0];

    // If multi-store, fetch all order items from all orders
    const orderIdsToFetch = allOrderIds || [primaryOrderId];
    const allItems = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId, // Include orderId for each item
        listingId: orderItems.listingId,
        title: orderItems.title,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
        sku: orderItems.sku,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIdsToFetch));

    // Get listing and store info for review links
    const listingIds = allItems
      .map((item) => item.listingId)
      .filter((id): id is string => !!id);

    const listingMap = new Map<
      string,
      { slug: string | null; storeId: string | null }
    >();
    const storeMap = new Map<string, { slug: string | null }>();

    if (listingIds.length > 0) {
      const listings = await db
        .select({
          id: listing.id,
          slug: listing.slug,
          storeId: listing.storeId,
        })
        .from(listing)
        .where(inArray(listing.id, listingIds));

      for (const l of listings) {
        listingMap.set(l.id, { slug: l.slug, storeId: l.storeId });
      }

      const storeIds = Array.from(
        new Set(
          Array.from(listingMap.values())
            .map((l) => l.storeId)
            .filter((id): id is string => !!id)
        )
      );

      if (storeIds.length > 0) {
        const stores = await db
          .select({
            id: store.id,
            slug: store.slug,
          })
          .from(store)
          .where(inArray(store.id, storeIds));

        for (const s of stores) {
          storeMap.set(s.id, { slug: s.slug });
        }
      }
    }

    const customerName =
      order.customerFirstName && order.customerLastName
        ? `${order.customerFirstName} ${order.customerLastName}`
        : order.customerEmail || "Customer";

    const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders/${primaryOrderId}`;

    if (!order.customerEmail) {
      console.error("Customer email is required to send confirmation email");
      return;
    }

    // Calculate totals from all items if multi-store
    const subtotal = allOrderIds
      ? allItems
          .reduce((sum, item) => sum + parseFloat(item.lineTotal || "0"), 0)
          .toFixed(2)
      : order.subtotalAmount;

    // For multi-store, fetch all orders to sum up shipping, discount, and tax
    let totalShipping = "0";
    let totalDiscount = "0";
    let totalTax = "0";

    if (allOrderIds && allOrderIds.length > 1) {
      const allOrders = await db
        .select({
          shippingAmount: orders.shippingAmount,
          discountAmount: orders.discountAmount,
          taxAmount: orders.taxAmount,
        })
        .from(orders)
        .where(inArray(orders.id, allOrderIds));

      totalShipping = allOrders
        .reduce((sum, o) => sum + parseFloat(o.shippingAmount || "0"), 0)
        .toFixed(2);
      totalDiscount = allOrders
        .reduce((sum, o) => sum + parseFloat(o.discountAmount || "0"), 0)
        .toFixed(2);
      totalTax = allOrders
        .reduce((sum, o) => sum + parseFloat(o.taxAmount || "0"), 0)
        .toFixed(2);
    } else {
      totalShipping = order.shippingAmount || "0";
      totalDiscount = order.discountAmount || "0";
      totalTax = order.taxAmount || "0";
    }

    // Calculate total: subtotal - discount + shipping + tax
    const total = (
      parseFloat(subtotal) -
      parseFloat(totalDiscount) +
      parseFloat(totalShipping) +
      parseFloat(totalTax)
    ).toFixed(2);

    await resend.emails.send({
      from: "Golden Market <goldenmarket@resend.dev>",
      to: order.customerEmail,
      subject: `Order Confirmation #${order.orderNumber}`,
      react: OrderConfirmationEmail({
        orderNumber: order.orderNumber,
        orderId: primaryOrderId,
        customerName,
        customerEmail: order.customerEmail,
        items: allItems.map((item) => {
          const listingInfo = item.listingId
            ? listingMap.get(item.listingId)
            : null;
          const storeInfo = listingInfo?.storeId
            ? storeMap.get(listingInfo.storeId)
            : null;
          return {
            title: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal || "0",
            sku: item.sku || null,
            listingId: item.listingId || null,
            listingSlug: listingInfo?.slug || null,
            storeId: listingInfo?.storeId || null,
            storeSlug: storeInfo?.slug || null,
            orderId: item.orderId || null, // Include the orderId for this specific item
          };
        }),
        subtotal: subtotal,
        discount: totalDiscount,
        shipping: totalShipping,
        tax: totalTax,
        total: total,
        currency: order.currency,
        paymentStatus: order.paymentStatus === "paid" ? "paid" : "pending",
        orderStatus:
          order.status === "completed"
            ? "fulfilled"
            : (order.status as "open" | "fulfilled" | "cancelled"),
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
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    throw error;
  }
}

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
      let storeBreakdown: Record<
        string,
        { stripeAccountId: string; amount: number; orderIds: string[] }
      > | null = null;
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
            console.error(
              "Failed to parse store breakdown from payment intent:",
              e
            );
          }
        }
      }

      console.log(
        "📋 Payment Intent metadata:",
        JSON.stringify(paymentIntent.metadata, null, 2)
      );
      console.log("🔍 Draft ID:", draftId);
      console.log("🔍 Order ID:", orderId);
      console.log("🔍 Is Multi-Store:", isMultiStore);
      console.log(
        "🔍 Store Breakdown:",
        storeBreakdown ? "Present" : "Missing"
      );

      // For multi-store checkout, we don't need draftId or orderId
      // Skip the validation if it's a multi-store checkout
      if (!isMultiStore && !draftId && !orderId) {
        console.error("❌ Missing both draftId and orderId in metadata");
        return NextResponse.json(
          { error: "Missing draftId or orderId" },
          { status: 400 }
        );
      }

      // Handle multi-store payments (create ledger entries instead of transfers)
      if (isMultiStore && storeBreakdown) {
        console.log("🏪 Processing multi-store payments (ledger system)...");
        console.log(
          "💰 Store breakdown:",
          JSON.stringify(storeBreakdown, null, 2)
        );

        // Import balance management function
        const { updateSellerBalance } = await import(
          "@/app/[locale]/actions/seller-balance"
        );

        // Calculate Stripe fee (2.9% + €0.30 per transaction)
        const stripeFeeRate = 0.029;
        const stripeFeeFixed = 0.3;
        const totalAmount = paymentIntent.amount / 100;
        const stripeFee = totalAmount * stripeFeeRate + stripeFeeFixed;

        for (const [storeId, storeInfo] of Object.entries(storeBreakdown)) {
          const storeAmount = storeInfo.amount / 100; // Convert cents to currency
          const platformFee = storeAmount * 0.05; // 5% platform fee
          const storeStripeFee = (stripeFee * storeAmount) / totalAmount; // Proportional Stripe fee

          console.log(`💰 Processing payment for store ${storeId}:`, {
            storeAmount: storeAmount.toFixed(2),
            platformFee: platformFee.toFixed(2),
            stripeFee: storeStripeFee.toFixed(2),
          });

          try {
            // Create payment records and update order status for each order in this store
            for (const orderId of storeInfo.orderIds) {
              const orderData = await db
                .select({
                  id: orders.id,
                  totalAmount: orders.totalAmount,
                  currency: orders.currency,
                  fulfillmentStatus: orders.fulfillmentStatus,
                  status: orders.status,
                  storeId: orders.storeId,
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
              const orderStripeFee = (stripeFee * orderAmount) / totalAmount;

              // Store charge ID for transfer when hold ends (separate charges + transfers)
              const chargeId =
                typeof paymentIntent.latest_charge === "string"
                  ? paymentIntent.latest_charge
                  : paymentIntent.latest_charge?.id ?? null;

              // Create payment record with "held" status
              const [paymentRecord] = await db
                .insert(orderPayments)
                .values({
                  orderId: orderId,
                  amount: orderAmount.toFixed(2),
                  currency: order.currency,
                  provider: "stripe",
                  providerPaymentId: paymentIntentId,
                  platformFeeAmount: orderPlatformFee.toFixed(2),
                  netAmountToStore: (
                    orderAmount -
                    orderPlatformFee -
                    orderStripeFee
                  ).toFixed(2),
                  stripePaymentIntentId: paymentIntentId,
                  stripeCheckoutSessionId: session.id,
                  stripeChargeId: chargeId,
                  status: "completed",
                  transferStatus: "held", // Funds held in platform account
                })
                .returning();

              // Check payment intent status - with manual capture, payment might not be captured yet
              // Only update balance and set paymentStatus to "paid" if payment is actually captured (succeeded)
              // If status is "requires_capture", keep it as "pending" until seller captures
              const paymentIntentStatus = paymentIntent.status;
              const isPaymentCaptured = paymentIntentStatus === "succeeded";

              // Only update seller balance if payment is actually captured
              // Balance will be updated when seller captures payment if not captured yet
              if (isPaymentCaptured) {
                // Create ledger entries
                // 1. Order payment (CREDIT)
                await updateSellerBalance({
                  storeId: order.storeId!,
                  type: "order_payment",
                  amount: orderAmount, // Already includes discount
                  currency: order.currency,
                  orderId: orderId,
                  orderPaymentId: paymentRecord.id,
                  description: `Order payment received (discount already applied)`,
                });

                // 2. Platform fee (DEBIT)
                await updateSellerBalance({
                  storeId: order.storeId!,
                  type: "platform_fee",
                  amount: orderPlatformFee,
                  currency: order.currency,
                  orderId: orderId,
                  orderPaymentId: paymentRecord.id,
                  description: `Platform fee (5%) for order`,
                });

                // 3. Stripe fee (DEBIT)
                await updateSellerBalance({
                  storeId: order.storeId!,
                  type: "stripe_fee",
                  amount: orderStripeFee,
                  currency: order.currency,
                  orderId: orderId,
                  orderPaymentId: paymentRecord.id,
                  description: `Stripe processing fee for order`,
                });
              } else {
                console.log(
                  `[Webhook] Payment not captured yet (status: ${paymentIntentStatus}). Balance will be updated when payment is captured.`
                );
              }
              
              console.log(
                `[Webhook] Payment Intent status: ${paymentIntentStatus}, isPaymentCaptured: ${isPaymentCaptured}`
              );

              // Update order payment status and check if order should be completed
              const isFulfilled =
                order.fulfillmentStatus === "fulfilled" ||
                order.fulfillmentStatus === "partial";

              let newOrderStatus = order.status;
              if (isFulfilled && isPaymentCaptured) {
                newOrderStatus = "completed";
                console.log(
                  `[Webhook] Order ${orderId} is paid and fulfilled, setting status to completed`
                );
              }

              // Only update payment status to "paid" if payment is actually captured
              // Otherwise, keep it as "pending" (manual capture mode)
              await db
                .update(orders)
                .set({
                  paymentStatus: isPaymentCaptured ? "paid" : "pending",
                  paidAt: isPaymentCaptured ? new Date() : null,
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
                  amount: orderAmount.toFixed(2),
                  currency: order.currency,
                  fee: orderPlatformFee.toFixed(2),
                  stripe_checkout_session: session.id,
                  provider: "stripe",
                  paymentIntentId: paymentIntentId,
                },
                createdBy: null, // Webhook event
              });
            }
          } catch (error) {
            console.error(
              `❌ Failed to process payment for store ${storeId}:`,
              error
            );
            // Continue with other stores even if one fails
          }
        }

        console.log(
          "✅ Multi-store payments processed (ledger entries created)"
        );

        // Generate invoices for all orders in background (don't await to avoid blocking)
        if (orderIdsArray.length > 0) {
          for (const orderId of orderIdsArray) {
            // Generate invoice asynchronously
            (async () => {
              try {
                const { generateInvoiceForOrder } = await import(
                  "@/app/[locale]/actions/invoice"
                );
                console.log(
                  `[Invoice] Generating invoice for order ${orderId}`
                );
                const invoiceResult = await generateInvoiceForOrder(orderId);
                if (invoiceResult.success && invoiceResult.invoicePdfUrl) {
                  console.log(
                    `[Invoice] ✅ Invoice PDF generated: ${invoiceResult.invoicePdfUrl}`
                  );
                  console.log(
                    `[Invoice] Invoice Number: ${invoiceResult.invoiceNumber}`
                  );
                } else {
                  console.error(
                    `[Invoice] ❌ Failed to generate invoice: ${invoiceResult.error}`
                  );
                }
              } catch (error) {
                console.error(
                  `[Invoice] ❌ Exception generating invoice:`,
                  error
                );
                if (error instanceof Error) {
                  console.error(`[Invoice] Error message: ${error.message}`);
                  console.error(`[Invoice] Error stack: ${error.stack}`);
                }
              }
            })();
          }
        }

        // Send confirmation email for multi-store checkout (send one email with all orders)
        try {
          // Get all order IDs from the breakdown
          const allOrderIds = orderIdsArray;
          if (allOrderIds.length > 0) {
            // Send email for the first order (primary order) which will include all items
            await sendOrderConfirmationEmail(
              allOrderIds[0],
              session.id,
              allOrderIds
            );
            console.log("✅ Confirmation email sent for multi-store checkout");
          }
        } catch (emailError) {
          console.error("❌ Failed to send confirmation email:", emailError);
          // Don't fail the webhook if email fails
        }

        return NextResponse.json({ received: true });
      }

      // Single order flow (ledger system)
      // Calculate amounts - payment amount already includes discount
      const totalAmount = paymentIntent.amount / 100; // Already includes discount
      const platformFee = totalAmount * 0.05; // 5% platform fee
      const stripeFeeRate = 0.029;
      const stripeFeeFixed = 0.3;
      const stripeFee = totalAmount * stripeFeeRate + stripeFeeFixed;
      const netAmountToStore = totalAmount - platformFee - stripeFee;

      console.log("💰 Payment amounts:", {
        totalAmount: totalAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        stripeFee: stripeFee.toFixed(2),
        netAmountToStore: netAmountToStore.toFixed(2),
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

        // Check payment intent status - with manual capture, payment might not be captured yet
        // Only set paymentStatus to "paid" if payment is actually captured (succeeded)
        // If status is "requires_capture", keep it as "pending" until seller captures
        const paymentIntentStatus = paymentIntent.status;
        const isPaymentCaptured = paymentIntentStatus === "succeeded";
        
        console.log(
          `[Webhook] Payment Intent status: ${paymentIntentStatus}, isPaymentCaptured: ${isPaymentCaptured}`
        );

        const isFulfilled =
          fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partial";

        // If paid and fulfilled → "completed"
        let newOrderStatus = currentStatus;
        if (isFulfilled && isPaymentCaptured) {
          newOrderStatus = "completed";
          console.log(
            `[Webhook] Order ${orderId} is paid and fulfilled, setting status to completed`
          );
        }

        // Only update payment status to "paid" if payment is actually captured
        // Otherwise, keep it as "pending" (manual capture mode)
        await db
          .update(orders)
          .set({
            paymentStatus: isPaymentCaptured ? "paid" : "pending",
            paidAt: isPaymentCaptured ? new Date() : null,
            status: newOrderStatus,
          })
          .where(eq(orders.id, orderId));
        console.log(
          `✅ Order payment status updated to: ${isPaymentCaptured ? "paid" : "pending"}`
        );

        // Generate invoice for regular order payment (don't await to avoid blocking)
        (async () => {
          try {
            const { generateInvoiceForOrder } = await import(
              "@/app/[locale]/actions/invoice"
            );
            console.log(`[Invoice] Generating invoice for order ${orderId}`);
            const invoiceResult = await generateInvoiceForOrder(orderId);
            if (invoiceResult.success && invoiceResult.invoicePdfUrl) {
              console.log(
                `[Invoice] ✅ Invoice PDF generated: ${invoiceResult.invoicePdfUrl}`
              );
              console.log(
                `[Invoice] Invoice Number: ${invoiceResult.invoiceNumber}`
              );
            } else {
              console.error(
                `[Invoice] ❌ Failed to generate invoice: ${invoiceResult.error}`
              );
            }
          } catch (error) {
            console.error(`[Invoice] ❌ Exception generating invoice:`, error);
            if (error instanceof Error) {
              console.error(`[Invoice] Error message: ${error.message}`);
              console.error(`[Invoice] Error stack: ${error.stack}`);
            }
          }
        })();
      } else {
        return NextResponse.json(
          { error: "Invalid metadata" },
          { status: 400 }
        );
      }

      // Get order store ID for ledger entries
      const orderStoreData = await db
        .select({
          storeId: orders.storeId,
        })
        .from(orders)
        .where(eq(orders.id, finalOrderId))
        .limit(1);

      if (orderStoreData.length === 0 || !orderStoreData[0].storeId) {
        console.error("❌ Order store not found");
        return NextResponse.json(
          { error: "Order store not found" },
          { status: 400 }
        );
      }

      const orderStoreId = orderStoreData[0].storeId;

      // Store charge ID for transfer when hold ends (separate charges + transfers)
      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id ?? null;

      // Create payment record (single store) with "held" status
      console.log("💾 Creating payment record...");
      const [paymentRecord] = await db
        .insert(orderPayments)
        .values({
          orderId: finalOrderId,
          amount: totalAmount.toFixed(2),
          currency: currency,
          provider: "stripe",
          providerPaymentId: paymentIntentId,
          platformFeeAmount: platformFee.toFixed(2),
          netAmountToStore: netAmountToStore.toFixed(2),
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: session.id,
          stripeChargeId: chargeId,
          status: "completed",
          transferStatus: "held", // Funds held in platform account
        })
        .returning();
      console.log("✅ Payment record created");

      // Check payment intent status - with manual capture, payment might not be captured yet
      // Only update balance if payment is actually captured (succeeded)
      const paymentIntentStatus = paymentIntent.status;
      const isPaymentCaptured = paymentIntentStatus === "succeeded";

      // Only update seller balance if payment is actually captured
      // Balance will be updated when seller captures payment if not captured yet
      if (isPaymentCaptured) {
        // Import balance management function
        const { updateSellerBalance } = await import(
          "@/app/[locale]/actions/seller-balance"
        );

        // Create ledger entries
        // 1. Order payment (CREDIT) - amount already includes discount
        await updateSellerBalance({
          storeId: orderStoreId,
          type: "order_payment",
          amount: totalAmount,
          currency: currency,
          orderId: finalOrderId,
          orderPaymentId: paymentRecord.id,
          description: `Order payment received (discount already applied)`,
        });

        // 2. Platform fee (DEBIT)
        await updateSellerBalance({
          storeId: orderStoreId,
          type: "platform_fee",
          amount: platformFee,
          currency: currency,
          orderId: finalOrderId,
          orderPaymentId: paymentRecord.id,
          description: `Platform fee (5%) for order`,
        });

        // 3. Stripe fee (DEBIT)
        await updateSellerBalance({
          storeId: orderStoreId,
          type: "stripe_fee",
          amount: stripeFee,
          currency: currency,
          orderId: finalOrderId,
          orderPaymentId: paymentRecord.id,
          description: `Stripe processing fee for order`,
        });
      } else {
        console.log(
          `[Webhook] Payment not captured yet (status: ${paymentIntentStatus}). Balance will be updated when payment is captured.`
        );
      }

      // Create order event (createdBy is null for webhook events)
      console.log("📝 Creating order event...");
      await db.insert(orderEvents).values({
        orderId: finalOrderId,
        type: "payment",
        message: "Payment received via Stripe Checkout",
        visibility: "internal",
        metadata: {
          amount: totalAmount.toFixed(2),
          currency: currency,
          platformFee: platformFee.toFixed(2),
          stripeFee: stripeFee.toFixed(2),
          stripe_checkout_session: session.id,
          provider: "stripe",
          paymentIntentId: paymentIntentId,
          checkoutSessionId: session.id,
        },
        createdBy: null, // Webhook event
      });
      console.log("✅ Order event created");

      // Send confirmation email
      try {
        await sendOrderConfirmationEmail(finalOrderId, session.id);
        console.log("✅ Confirmation email sent");
      } catch (emailError) {
        console.error("❌ Failed to send confirmation email:", emailError);
        // Don't fail the webhook if email fails
      }

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
      // For thin payloads, we might need to retrieve the full refund
      // Find the payment intent associated with this refund
      let paymentIntentId: string | null = null;

      if (refund.payment_intent) {
        paymentIntentId =
          typeof refund.payment_intent === "string"
            ? refund.payment_intent
            : refund.payment_intent.id;
      } else {
        // Thin payload might not include payment_intent, retrieve full refund
        console.log("📋 Thin payload detected, retrieving full refund object");
        const fullRefund = await stripe.refunds.retrieve(refund.id);
        paymentIntentId =
          typeof fullRefund.payment_intent === "string"
            ? fullRefund.payment_intent
            : fullRefund.payment_intent?.id || null;
      }

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

      const refundedAmount = totalRefundedAmount / 100; // Convert from cents to currency
      const previousRefundedAmount = parseFloat(payment.refundedAmount || "0");
      const newRefundAmount = refundedAmount - previousRefundedAmount; // Amount of this refund

      // Update payment record with total refunded amount
      await db
        .update(orderPayments)
        .set({
          refundedAmount: refundedAmount.toFixed(2),
          status:
            totalRefundedAmount === 0
              ? "completed"
              : totalRefundedAmount >= parseFloat(payment.amount) * 100
                ? "refunded"
                : "partially_refunded",
        })
        .where(eq(orderPayments.id, payment.id));

      // Update seller balance ledger for refund
      // Only debit if this is a new refund (not already recorded)
      if (newRefundAmount > 0) {
        // Get order to find storeId
        const orderData = await db
          .select({
            storeId: orders.storeId,
            currency: orders.currency,
          })
          .from(orders)
          .where(eq(orders.id, payment.orderId))
          .limit(1);

        if (orderData.length > 0 && orderData[0].storeId) {
          const { updateSellerBalance } = await import(
            "@/app/[locale]/actions/seller-balance"
          );

          // Debit the refunded amount from seller balance
          await updateSellerBalance({
            storeId: orderData[0].storeId,
            type: "refund",
            amount: newRefundAmount, // Will be debited (negative)
            currency: orderData[0].currency,
            orderId: payment.orderId,
            orderPaymentId: payment.id,
            description: `Refund processed (${newRefundAmount.toFixed(2)} ${orderData[0].currency})`,
          });

          console.log(
            `✅ Seller balance debited for refund: ${newRefundAmount} ${orderData[0].currency}`
          );
        }
      }

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
            error instanceof Error ? error.message : "Failed to process refund",
        },
        { status: 500 }
      );
    }
  }

  // Handle payment_intent.succeeded event (when payment is captured)
  if (event.type === "payment_intent.succeeded") {
    console.log("✅ Processing payment_intent.succeeded event");
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      // Find orders associated with this payment intent
      const paymentRecords = await db
        .select({
          orderId: orderPayments.orderId,
          id: orderPayments.id,
        })
        .from(orderPayments)
        .where(eq(orderPayments.stripePaymentIntentId, paymentIntent.id));

      if (paymentRecords.length === 0) {
        console.log(
          "⚠️ No payment records found for payment intent:",
          paymentIntent.id
        );
        return NextResponse.json({ received: true });
      }

      // Update payment status for all associated orders
      for (const paymentRecord of paymentRecords) {
        const orderData = await db
          .select({
            id: orders.id,
            fulfillmentStatus: orders.fulfillmentStatus,
            status: orders.status,
          })
          .from(orders)
          .where(eq(orders.id, paymentRecord.orderId))
          .limit(1);

        if (orderData.length === 0) {
          console.error(
            `❌ Order not found for payment record: ${paymentRecord.id}`
          );
          continue;
        }

        const order = orderData[0];
        const isFulfilled =
          order.fulfillmentStatus === "fulfilled" ||
          order.fulfillmentStatus === "partial";

        let newOrderStatus = order.status;
        if (isFulfilled) {
          newOrderStatus = "completed";
          console.log(
            `[Webhook] Order ${order.id} is paid and fulfilled, setting status to completed`
          );
        }

        // Update order payment status to "paid" now that payment is captured
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            paidAt: new Date(),
            status: newOrderStatus,
          })
          .where(eq(orders.id, order.id));

        // Update payment record status and ensure charge ID is set (for transfer when hold ends)
        const chargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id ?? null;
        await db
          .update(orderPayments)
          .set({
            status: "completed",
            ...(chargeId ? { stripeChargeId: chargeId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(orderPayments.id, paymentRecord.id));

        console.log(
          `✅ Updated order ${order.id} payment status to "paid" after capture`
        );
      }

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("❌ Error processing payment_intent.succeeded:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to process payment intent succeeded",
        },
        { status: 500 }
      );
    }
  }

  // Handle payment_intent.canceled event (when payment is voided before capture)
  if (event.type === "payment_intent.canceled") {
    console.log("🚫 Processing payment_intent.canceled event");
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      // Find the order payment record
      const paymentRecord = await db
        .select({
          id: orderPayments.id,
          orderId: orderPayments.orderId,
        })
        .from(orderPayments)
        .where(eq(orderPayments.stripePaymentIntentId, paymentIntent.id))
        .limit(1);

      if (paymentRecord.length === 0) {
        console.error("❌ Payment record not found for canceled payment intent");
        return NextResponse.json(
          { error: "Payment record not found" },
          { status: 404 }
        );
      }

      const payment = paymentRecord[0];

      // Update payment status to "void"
      await db
        .update(orderPayments)
        .set({
          status: "void",
          updatedAt: new Date(),
        })
        .where(eq(orderPayments.id, payment.id));

      // Update order payment status to "void"
      await db
        .update(orders)
        .set({
          paymentStatus: "void",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, payment.orderId));

      console.log("✅ Payment voided successfully");
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("❌ Error processing payment_intent.canceled:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to process canceled payment",
        },
        { status: 500 }
      );
    }
  }

  // Handle other event types
  console.log(`⚠️ Unhandled event type: ${event.type}`);
  return NextResponse.json({ received: true });
}
