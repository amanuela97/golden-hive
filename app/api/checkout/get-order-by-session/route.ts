import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, listing, store } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe to get order metadata
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Checkout session not found" },
        { status: 404 }
      );
    }

    const metadata = session.metadata || {};
    const orderId = metadata.orderId;
    const orderIds = metadata.orderIds ? JSON.parse(metadata.orderIds) : null;

    // Get order IDs to fetch
    const orderIdsToFetch = orderIds || (orderId ? [orderId] : []);

    if (orderIdsToFetch.length === 0) {
      return NextResponse.json(
        { error: "No order IDs found in session metadata" },
        { status: 404 }
      );
    }

    // Fetch all orders
    const ordersData = await db
      .select()
      .from(orders)
      .where(inArray(orders.id, orderIdsToFetch));

    if (ordersData.length === 0) {
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    // Get primary order (first one)
    const primaryOrder = ordersData[0];

    // Fetch all order items from all orders
    const items = await db
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
    const listingIds = items
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

    // Format items with review links
    const formattedItems = items.map((item) => {
      const listingInfo = item.listingId
        ? listingMap.get(item.listingId)
        : null;
      const storeInfo = listingInfo?.storeId
        ? storeMap.get(listingInfo.storeId)
        : null;
      return {
        id: item.id,
        orderId: item.orderId, // Include orderId for each item (for multi-store orders)
        listingId: item.listingId,
        listingSlug: listingInfo?.slug || null,
        storeId: listingInfo?.storeId || null,
        storeSlug: storeInfo?.slug || null,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        sku: item.sku,
      };
    });

    return NextResponse.json({
      success: true,
      order: {
        id: primaryOrder.id,
        orderNumber: primaryOrder.orderNumber,
        paymentStatus: primaryOrder.paymentStatus,
        status: primaryOrder.status,
        customerEmail: primaryOrder.customerEmail,
        items: formattedItems,
      },
    });
  } catch (error) {
    console.error("Error fetching order by session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch order details",
      },
      { status: 500 }
    );
  }
}
