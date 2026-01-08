import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  store,
  orders,
  orderItems,
  listing,
  listingVariants,
  storeMembers,
  roles,
  userRoles,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateOrderNumber } from "@/lib/order-number";

/**
 * Helper to get store ID for user
 */
async function getStoreIdForUser(): Promise<{
  storeId: string | null;
  isAdmin: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { storeId: null, isAdmin: false, error: "Unauthorized" };
  }

  // Check if user is admin
  const userRole = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);

  const isAdmin =
    userRole.length > 0 && userRole[0].roleName.toLowerCase() === "admin";

  if (isAdmin) {
    return { storeId: null, isAdmin: true };
  }

  // Get store ID from storeMembers
  const member = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, session.user.id))
    .limit(1);

  if (member.length === 0) {
    return { storeId: null, isAdmin: false, error: "No store found for user" };
  }

  return { storeId: member[0].storeId, isAdmin: false };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId, // Optional existing order ID (single order, backward compatibility)
      orderIds, // Optional array of order IDs (multi-store checkout)
      storeId: providedStoreId,
      currency,
      items,
      customerEmail,
    } = body;

    // If orderId or orderIds is provided, allow guest access (order already created)
    // If neither is provided, require authentication (admin/seller use case)
    if (!orderId && !orderIds) {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Normalize to array of order IDs
    const orderIdsArray = orderIds || (orderId ? [orderId] : []);

    // Handle multiple orders (multi-store checkout)
    if (orderIdsArray.length > 1) {
      // Multi-store checkout: Create ONE checkout session that collects payment to platform
      // Then transfer funds to each store after payment succeeds (via webhook)

      // Group orders by store and calculate totals
      const storeBreakdown = new Map<
        string,
        {
          storeId: string;
          stripeAccountId: string;
          orderIds: string[];
          amount: number; // in cents
          currency: string;
        }
      >();

      const allLineItems: Array<{
        quantity: number;
        price_data: {
          currency: string;
          unit_amount: number;
          product_data: {
            name: string;
            description?: string;
          };
        };
      }> = [];

      let currency = "eur";
      let totalShippingAmount = 0;
      let totalTaxAmount = 0;

      for (const currentOrderId of orderIdsArray) {
        // Fetch order from database
        const existingOrder = await db
          .select()
          .from(orders)
          .where(eq(orders.id, currentOrderId))
          .limit(1);

        if (existingOrder.length === 0) continue;

        const order = existingOrder[0];
        const storeId = order.storeId;
        if (!storeId) continue;

        currency = order.currency.toLowerCase();

        // Get store with Stripe account
        const storeData = await db
          .select()
          .from(store)
          .where(eq(store.id, storeId))
          .limit(1);

        if (storeData.length === 0 || !storeData[0].stripeAccountId) continue;

        const storeInfo = storeData[0];

        // Fetch order items (including lineTotal which has discounts applied)
        const orderItemsData = await db
          .select({
            listingId: orderItems.listingId,
            variantId: orderItems.variantId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            lineTotal: orderItems.lineTotal,
            title: orderItems.title,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, currentOrderId));

        // Get listings and variants
        const listingIds = [
          ...new Set(
            orderItemsData
              .map((item) => item.listingId)
              .filter((id): id is string => id !== null)
          ),
        ];
        const listings = await db
          .select()
          .from(listing)
          .where(inArray(listing.id, listingIds));

        const variantIds = orderItemsData
          .map((item) => item.variantId)
          .filter((id): id is string => id !== null);
        let variants: (typeof listingVariants.$inferSelect)[] = [];
        if (variantIds.length > 0) {
          variants = await db
            .select()
            .from(listingVariants)
            .where(inArray(listingVariants.id, variantIds));
        }

        // Build line items and calculate order total
        // Use lineTotal from database which already includes item-level discounts
        let orderTotalCents = 0;

        for (const item of orderItemsData) {
          const listingItem = listings.find((l) => l.id === item.listingId);
          if (!listingItem) continue;

          const variant = item.variantId
            ? variants.find((v) => v.id === item.variantId) || null
            : null;

          // Use lineTotal from database which already includes item-level discounts
          // lineTotal is the final price after discount for this item
          const discountedLineTotal = parseFloat(item.lineTotal);
          const discountedUnitPrice = discountedLineTotal / item.quantity;
          const discountedUnitPriceCents = Math.round(
            discountedUnitPrice * 100
          );
          orderTotalCents += discountedUnitPriceCents * item.quantity;

          allLineItems.push({
            quantity: item.quantity,
            price_data: {
              currency: currency,
              unit_amount: discountedUnitPriceCents, // Use discounted unit price
              product_data: {
                name: item.title,
                description: variant
                  ? `${item.title} - ${variant.title}`
                  : undefined,
              },
            },
          });
        }

        // Add shipping, tax, discount from order totals
        const orderSubtotal = parseFloat(order.subtotalAmount || "0");
        const orderShipping = parseFloat(order.shippingAmount || "0");
        const orderTax = parseFloat(order.taxAmount || "0");
        const orderDiscount = parseFloat(order.discountAmount || "0");
        const orderTotal =
          orderSubtotal + orderShipping + orderTax - orderDiscount;
        const orderTotalCentsFromDB = Math.round(orderTotal * 100);

        // Accumulate shipping and tax for all orders
        totalShippingAmount += orderShipping;
        totalTaxAmount += orderTax;

        // Use the order total from DB (includes shipping/tax/discount)
        orderTotalCents = orderTotalCentsFromDB;

        // Update store breakdown
        if (!storeBreakdown.has(storeId)) {
          if (!storeInfo.stripeAccountId) continue; // Skip if no Stripe account
          storeBreakdown.set(storeId, {
            storeId,
            stripeAccountId: storeInfo.stripeAccountId,
            orderIds: [],
            amount: 0,
            currency,
          });
        }

        const storeInfo_ = storeBreakdown.get(storeId)!;
        if (storeInfo_) {
          storeInfo_.orderIds.push(currentOrderId);
          storeInfo_.amount += orderTotalCents;
        }
      }

      if (storeBreakdown.size === 0) {
        return NextResponse.json(
          { error: "Failed to process orders" },
          { status: 400 }
        );
      }

      // Create store breakdown metadata
      const storeBreakdownMetadata: Record<
        string,
        { stripeAccountId: string; amount: number; orderIds: string[] }
      > = {};
      for (const [storeId, info] of storeBreakdown.entries()) {
        storeBreakdownMetadata[storeId] = {
          stripeAccountId: info.stripeAccountId,
          amount: info.amount,
          orderIds: info.orderIds,
        };
      }

      // Add shipping and tax as separate line items if they exist
      if (totalShippingAmount > 0) {
        allLineItems.push({
          quantity: 1,
          price_data: {
            currency: currency,
            unit_amount: Math.round(totalShippingAmount * 100),
            product_data: {
              name: "Shipping",
              description: undefined,
            },
          },
        });
      }
      if (totalTaxAmount > 0) {
        allLineItems.push({
          quantity: 1,
          price_data: {
            currency: currency,
            unit_amount: Math.round(totalTaxAmount * 100),
            product_data: {
              name: "Tax",
              description: undefined,
            },
          },
        });
      }

      // Create ONE checkout session that collects payment to platform account
      // (No destination charges - we'll transfer manually after payment)
      // Use manual capture to allow cancellation before capture (no Stripe fees)
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customerEmail || undefined,
        line_items: allLineItems,
        payment_intent_data: {
          capture_method: "manual", // ✅ Manual capture - allows voiding before capture
          metadata: {
            orderIds: JSON.stringify(orderIdsArray),
            storeBreakdown: JSON.stringify(storeBreakdownMetadata),
            multiStore: "true",
          },
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel?orderIds=${encodeURIComponent(JSON.stringify(orderIdsArray))}`,
        metadata: {
          orderIds: JSON.stringify(orderIdsArray),
          storeBreakdown: JSON.stringify(storeBreakdownMetadata),
          multiStore: "true",
        },
      });

      return NextResponse.json({
        url: checkoutSession.url,
        orderId: orderIdsArray[0], // Primary order ID for backward compatibility
        orderNumber: 0, // Will be set from first order
        allOrders: orderIdsArray.map((id: string) => ({ orderId: id })),
      });
    }

    // Single order flow (existing logic)
    let finalOrderId: string;
    let finalStoreId: string;
    let orderRow: { id: string; orderNumber: string };
    const lineItemsData: Array<{
      listing: typeof listing.$inferSelect;
      variant: typeof listingVariants.$inferSelect | null;
      quantity: number;
      unitPrice: number;
    }> = [];
    let total = 0;
    let finalCurrency: string;
    let orderShippingAmount = 0;
    let orderTaxAmount = 0;
    let orderTotalAmount = 0;

    const singleOrderId = orderIdsArray[0];
    if (singleOrderId) {
      // Use existing order
      finalOrderId = singleOrderId;

      // Fetch order from database
      const existingOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, singleOrderId))
        .limit(1);

      if (existingOrder.length === 0) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      orderRow = {
        id: existingOrder[0].id,
        orderNumber: existingOrder[0].orderNumber,
      };
      finalStoreId = existingOrder[0].storeId!;
      orderShippingAmount = parseFloat(existingOrder[0].shippingAmount || "0");
      orderTaxAmount = parseFloat(existingOrder[0].taxAmount || "0");
      orderTotalAmount = parseFloat(existingOrder[0].totalAmount || "0");

      // Fetch order items (including lineTotal which has discounts applied)
      const orderItemsData = await db
        .select({
          listingId: orderItems.listingId,
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          lineTotal: orderItems.lineTotal,
          discountAmount: orderItems.discountAmount,
          title: orderItems.title,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, singleOrderId));

      // Get listings and variants for line items
      const listingIds = [
        ...new Set(
          orderItemsData
            .map((item) => item.listingId)
            .filter((id): id is string => id !== null)
        ),
      ];
      const listings = await db
        .select()
        .from(listing)
        .where(inArray(listing.id, listingIds));

      const variantIds = orderItemsData
        .map((item) => item.variantId)
        .filter((id): id is string => id !== null);
      let variants: (typeof listingVariants.$inferSelect)[] = [];
      if (variantIds.length > 0) {
        variants = await db
          .select()
          .from(listingVariants)
          .where(inArray(listingVariants.id, variantIds));
      }

      // Build line items data using discounted prices from database
      // lineTotal already includes item-level discounts, so use it directly
      for (const item of orderItemsData) {
        const listingItem = listings.find((l) => l.id === item.listingId);
        if (!listingItem) continue;

        const variant = item.variantId
          ? variants.find((v) => v.id === item.variantId) || null
          : null;

        // Use lineTotal from database which already includes item-level discounts
        // lineTotal is the final price after discount for this item
        const discountedLineTotal = parseFloat(item.lineTotal);
        const discountedUnitPrice = discountedLineTotal / item.quantity;

        total += discountedLineTotal;

        lineItemsData.push({
          listing: listingItem,
          variant,
          quantity: item.quantity,
          unitPrice: discountedUnitPrice, // Use discounted unit price
        });
      }

      // The total should be the sum of discounted line items + shipping + tax
      // Use the order's totalAmount which is the source of truth
      total = orderTotalAmount;

      finalCurrency = existingOrder[0].currency;
    } else {
      // Create new order (current behavior for admin/seller)
      if (!currency || !items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          {
            error:
              "currency and items are required when orderId is not provided",
          },
          { status: 400 }
        );
      }

      // Get store ID (from user or provided for admin)
      const {
        storeId: userStoreId,
        isAdmin,
        error: storeError,
      } = await getStoreIdForUser();

      if (storeError) {
        return NextResponse.json({ error: storeError }, { status: 403 });
      }

      // Determine final store ID
      let determinedStoreId: string | null = null;

      if (isAdmin) {
        if (!providedStoreId) {
          // For admin, try to get storeId from line items
          const listingIds = [
            ...new Set(
              items.map(
                (item: { listingId: string; variantId?: string | null }) =>
                  item.listingId
              )
            ),
          ];
          if (listingIds.length > 0) {
            const listings = await db
              .select({ storeId: listing.storeId })
              .from(listing)
              .where(inArray(listing.id, listingIds))
              .limit(1);

            if (listings.length > 0) {
              determinedStoreId = listings[0].storeId;
            }
          }
        } else {
          determinedStoreId = providedStoreId;
        }
      } else {
        determinedStoreId = userStoreId;
      }

      if (!determinedStoreId) {
        return NextResponse.json(
          { error: "Store not found or not specified" },
          { status: 400 }
        );
      }

      finalStoreId = determinedStoreId;

      // Get store with Stripe account
      const storeData = await db
        .select()
        .from(store)
        .where(eq(store.id, finalStoreId))
        .limit(1);

      if (storeData.length === 0) {
        return NextResponse.json({ error: "Store not found" }, { status: 404 });
      }

      const storeInfo = storeData[0];

      if (!storeInfo.stripeAccountId) {
        return NextResponse.json(
          { error: "Store has not connected Stripe account" },
          { status: 400 }
        );
      }

      // Get listings and variants
      const listingIds = items
        .map(
          (item: { listingId: string; variantId?: string | null }) =>
            item.listingId
        )
        .filter((id): id is string => id !== null);
      const listings = await db
        .select()
        .from(listing)
        .where(inArray(listing.id, listingIds));

      if (listings.length !== listingIds.length) {
        return NextResponse.json(
          { error: "One or more listings not found" },
          { status: 400 }
        );
      }

      // Get variants if needed
      const variantIds = items
        .map(
          (item: { listingId: string; variantId?: string | null }) =>
            item.variantId
        )
        .filter((id): id is string => id !== null);
      let variants: (typeof listingVariants.$inferSelect)[] = [];
      if (variantIds.length > 0) {
        variants = await db
          .select()
          .from(listingVariants)
          .where(inArray(listingVariants.id, variantIds));
      }

      // Compute totals
      let subtotal = 0;

      for (const item of items as Array<{
        listingId: string;
        variantId?: string | null;
        quantity: number;
      }>) {
        const listingItem = listings.find((l) => l.id === item.listingId);
        if (!listingItem) {
          return NextResponse.json(
            { error: `Listing not found: ${item.listingId}` },
            { status: 400 }
          );
        }

        let unitPrice = parseFloat(listingItem.price);
        let variant: typeof listingVariants.$inferSelect | null = null;

        if (item.variantId) {
          variant = variants.find((v) => v.id === item.variantId) || null;
          if (!variant) {
            return NextResponse.json(
              { error: `Variant not found: ${item.variantId}` },
              { status: 400 }
            );
          }
          unitPrice = parseFloat(variant.price || listingItem.price);
        }

        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;

        lineItemsData.push({
          listing: listingItem,
          variant,
          quantity: item.quantity,
          unitPrice,
        });
      }

      total = subtotal; // Add shipping/tax later if needed
      finalCurrency = currency;

      // Generate unique order number
      const generatedOrderNumber = await generateOrderNumber();

      // Create order in DB
      const [newOrderRow] = await db
        .insert(orders)
        .values({
          orderNumber: generatedOrderNumber,
          storeId: finalStoreId,
          currency,
          subtotalAmount: subtotal.toFixed(2),
          totalAmount: total.toFixed(2),
          paymentStatus: "pending",
          fulfillmentStatus: "unfulfilled",
          status: "open",
          customerEmail: customerEmail || null,
        })
        .returning();

      orderRow = {
        id: newOrderRow.id,
        orderNumber: newOrderRow.orderNumber,
      };
      finalOrderId = newOrderRow.id;

      // Create order items in DB
      await db.insert(orderItems).values(
        lineItemsData.map((item) => ({
          orderId: newOrderRow.id,
          listingId: item.listing.id,
          variantId: item.variant?.id || null,
          title: item.listing.name,
          sku: item.variant?.sku || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          currency,
          lineSubtotal: (item.unitPrice * item.quantity).toFixed(2),
          lineTotal: (item.unitPrice * item.quantity).toFixed(2),
          discountAmount: "0",
          taxAmount: "0",
        }))
      );
    }

    // Get store with Stripe account
    const storeData = await db
      .select()
      .from(store)
      .where(eq(store.id, finalStoreId))
      .limit(1);

    if (storeData.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const storeInfo = storeData[0];

    if (!storeInfo.stripeAccountId) {
      return NextResponse.json(
        { error: "Store has not connected Stripe account" },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session with Connect (Destination Charges)
    // Use discounted unit prices to ensure discounts are correctly applied
    const stripeLineItems = lineItemsData.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: finalCurrency.toLowerCase(),
        unit_amount: Math.round(item.unitPrice * 100), // This is already the discounted unit price
        product_data: {
          name: item.listing.name,
          description: item.variant
            ? `${item.listing.name} - ${item.variant.title}`
            : undefined,
        },
      },
    }));

    // If there's shipping or tax, add them as separate line items to match the order total
    if (singleOrderId && (orderShippingAmount > 0 || orderTaxAmount > 0)) {
      // Add shipping and tax as separate line items if they exist
      if (orderShippingAmount > 0) {
        stripeLineItems.push({
          quantity: 1,
          price_data: {
            currency: finalCurrency.toLowerCase(),
            unit_amount: Math.round(orderShippingAmount * 100),
            product_data: {
              name: "Shipping",
              description: undefined,
            },
          },
        });
      }
      if (orderTaxAmount > 0) {
        stripeLineItems.push({
          quantity: 1,
          price_data: {
            currency: finalCurrency.toLowerCase(),
            unit_amount: Math.round(orderTaxAmount * 100),
            product_data: {
              name: "Tax",
              description: undefined,
            },
          },
        });
      }
    }

    // Create checkout session - payment goes to platform account (no destination charges)
    // Funds will be held and managed via ledger system
    // Use manual capture to allow cancellation before capture (no Stripe fees)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: stripeLineItems,
      payment_intent_data: {
        capture_method: "manual", // ✅ Manual capture - allows voiding before capture
        // No transfer_data or application_fee_amount - payment goes to platform
        metadata: {
          orderId: finalOrderId,
          storeId: finalStoreId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel?orderId=${finalOrderId}`,
      metadata: {
        orderId: finalOrderId,
        storeId: finalStoreId,
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      orderId: finalOrderId,
      orderNumber: orderRow.orderNumber,
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
