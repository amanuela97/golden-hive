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
  user,
  roles,
  userRoles,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storeId: providedStoreId, currency, items, customerEmail } = body;

    if (!currency || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "currency and items are required" },
        { status: 400 }
      );
    }

    // Get store ID (from user or provided for admin)
    const { storeId: userStoreId, isAdmin, error: storeError } =
      await getStoreIdForUser();

    if (storeError) {
      return NextResponse.json({ error: storeError }, { status: 403 });
    }

    // Determine final store ID
    let finalStoreId: string | null = null;

    if (isAdmin) {
      if (!providedStoreId) {
        // For admin, try to get storeId from line items
        const listingIds = [...new Set(items.map((item: any) => item.listingId))];
        if (listingIds.length > 0) {
          const listings = await db
            .select({ storeId: listing.storeId })
            .from(listing)
            .where(inArray(listing.id, listingIds))
            .limit(1);

          if (listings.length > 0) {
            finalStoreId = listings[0].storeId;
          }
        }
      } else {
        finalStoreId = providedStoreId;
      }
    } else {
      finalStoreId = userStoreId;
    }

    if (!finalStoreId) {
      return NextResponse.json(
        { error: "Store not found or not specified" },
        { status: 400 }
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

    // Get listings and variants
    const listingIds = items.map((item: any) => item.listingId);
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
      .map((item: any) => item.variantId)
      .filter((id: string | null) => id !== null);
    let variants: any[] = [];
    if (variantIds.length > 0) {
      variants = await db
        .select()
        .from(listingVariants)
        .where(inArray(listingVariants.id, variantIds));
    }

    // Compute totals
    let subtotal = 0;
    const lineItemsData: Array<{
      listing: any;
      variant: any | null;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of items) {
      const listingItem = listings.find((l) => l.id === item.listingId);
      if (!listingItem) {
        return NextResponse.json(
          { error: `Listing not found: ${item.listingId}` },
          { status: 400 }
        );
      }

      let unitPrice = parseFloat(listingItem.price);
      let variant = null;

      if (item.variantId) {
        variant = variants.find((v) => v.id === item.variantId);
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

    const total = subtotal; // Add shipping/tax later if needed
    const platformFeeCents = Math.round(total * 0.05 * 100); // 5% platform fee in cents
    const totalCents = Math.round(total * 100);

    // 1) Create order in DB
    const [orderRow] = await db
      .insert(orders)
      .values({
        storeId: finalStoreId,
        currency,
        subtotalAmount: subtotal.toFixed(2),
        totalAmount: total.toFixed(2),
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
        status: "open",
        customerEmail: customerEmail || null,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    // 2) Create order items in DB
    await db.insert(orderItems).values(
      lineItemsData.map((item) => ({
        orderId: orderRow.id,
        listingId: item.listing.id,
        variantId: item.variant?.id || null,
        title: item.listing.name,
        sku: item.variant?.sku || item.listing.sku || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        currency,
        lineSubtotal: (item.unitPrice * item.quantity).toFixed(2),
        lineTotal: (item.unitPrice * item.quantity).toFixed(2),
        discountAmount: "0",
        taxAmount: "0",
      }))
    );

    // 3) Adjust inventory (reserve items)
    // Note: Inventory adjustment should be handled via a separate action or service
    // For now, we'll skip it here as it requires importing from server actions
    // The inventory can be adjusted when the order is fulfilled or via a separate endpoint

    // 4) Create Stripe Checkout Session with Connect (Destination Charges)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: lineItemsData.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(item.unitPrice * 100),
          product_data: {
            name: item.listing.name,
            description: item.variant
              ? `${item.listing.name} - ${item.variant.name}`
              : undefined,
          },
        },
      })),
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        on_behalf_of: storeInfo.stripeAccountId,
        transfer_data: {
          destination: storeInfo.stripeAccountId,
        },
        metadata: {
          orderId: orderRow.id,
          storeId: finalStoreId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel?orderId=${orderRow.id}`,
      metadata: {
        orderId: orderRow.id,
        storeId: finalStoreId,
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      orderId: orderRow.id,
      orderNumber: Number(orderRow.orderNumber),
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}

