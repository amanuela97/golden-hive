import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, listing, store } from "@/db/schema";
import { inArray } from "drizzle-orm";

/**
 * GET /api/checkout/get-order-by-ids?orderIds=id1,id2
 * Returns the same order shape as get-order-by-session for eSewa (no Stripe session).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderIdsParam = searchParams.get("orderIds");
    if (!orderIdsParam) {
      return NextResponse.json(
        { error: "orderIds is required" },
        { status: 400 }
      );
    }
    const orderIdsToFetch = orderIdsParam.includes(",")
      ? orderIdsParam.split(",").map((id) => id.trim())
      : [orderIdsParam];

    if (orderIdsToFetch.length === 0) {
      return NextResponse.json(
        { error: "No order IDs provided" },
        { status: 400 }
      );
    }

    const ordersData = await db
      .select()
      .from(orders)
      .where(inArray(orders.id, orderIdsToFetch));

    if (ordersData.length === 0) {
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    const primaryOrder = ordersData[0];

    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        listingId: orderItems.listingId,
        title: orderItems.title,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
        sku: orderItems.sku,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIdsToFetch));

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

    const formattedItems = items.map((item) => {
      const listingInfo = item.listingId
        ? listingMap.get(item.listingId)
        : null;
      const storeInfo = listingInfo?.storeId
        ? storeMap.get(listingInfo.storeId)
        : null;
      return {
        id: item.id,
        orderId: item.orderId,
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
    console.error("Error fetching order by ids:", error);
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
