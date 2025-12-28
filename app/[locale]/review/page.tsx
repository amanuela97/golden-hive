import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReviewPageClient } from "./ReviewPageClient";
import { db } from "@/db";
import { orders, orderItems, listing, store } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Helper to check if string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

interface ReviewPageProps {
  searchParams: Promise<{
    order?: string;
    product?: string;
    store?: string;
  }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const orderId = params.order;
  const listingId = params.product;
  const storeId = params.store;

  if (!orderId) {
    notFound();
  }

  // Verify order exists and is paid
  const order = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerEmail: orders.customerEmail,
      paymentStatus: orders.paymentStatus,
      storeId: orders.storeId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (order.length === 0) {
    notFound();
  }

  if (order[0].paymentStatus !== "paid") {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">
            Order Not Ready for Review
          </h1>
          <p className="text-muted-foreground">
            You can only review products from paid orders.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthenticated = !!session?.user;

  // Get product info if productId provided (can be UUID or slug)
  let productData = null;
  if (listingId) {
    let product;

    // Check if listingId is a UUID or slug
    if (isValidUUID(listingId)) {
      // Query by UUID
      product = await db
        .select({
          id: listing.id,
          name: listing.name,
          imageUrl: listing.imageUrl,
          storeId: listing.storeId,
        })
        .from(listing)
        .where(eq(listing.id, listingId))
        .limit(1);
    } else {
      // Query by slug
      const slugLower = listingId.toLowerCase();
      product = await db
        .select({
          id: listing.id,
          name: listing.name,
          imageUrl: listing.imageUrl,
          storeId: listing.storeId,
        })
        .from(listing)
        .where(eq(listing.slugLower, slugLower))
        .limit(1);
    }

    if (product.length > 0) {
      const actualListingId = product[0].id;

      // Verify product is in order - check all order items to see if this product exists
      const orderItem = await db
        .select({ listingId: orderItems.listingId })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.listingId, actualListingId)
          )
        )
        .limit(1);

      if (orderItem.length > 0) {
        const storeData = await db
          .select({
            id: store.id,
            storeName: store.storeName,
            logoUrl: store.logoUrl,
          })
          .from(store)
          .where(eq(store.id, product[0].storeId || ""))
          .limit(1);

        productData = {
          id: product[0].id,
          name: product[0].name,
          imageUrl: product[0].imageUrl,
          storeName: storeData[0]?.storeName || "Unknown Store",
          storeLogo: storeData[0]?.logoUrl,
        };
      }
      // If product exists but is not in order, productData remains null
      // This will show the "Please provide a product or store ID" message
    }
  }

  // Get store info if storeId provided
  let storeData = null;
  if (storeId) {
    const storeInfo = await db
      .select({
        id: store.id,
        storeName: store.storeName,
        logoUrl: store.logoUrl,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeInfo.length > 0) {
      // Verify store has items in this order (for multi-store orders)
      // Check if any order items belong to this store
      const orderItemsForStore = await db
        .select({ listingId: orderItems.listingId })
        .from(orderItems)
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(
          and(eq(orderItems.orderId, orderId), eq(listing.storeId, storeId))
        )
        .limit(1);

      if (orderItemsForStore.length > 0) {
        storeData = {
          id: storeInfo[0].id,
          storeName: storeInfo[0].storeName,
          logoUrl: storeInfo[0].logoUrl,
        };
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Review Your Purchase</h1>
        <p className="text-muted-foreground mb-8">
          Order #{order[0].orderNumber}
        </p>

        <Suspense fallback={<div>Loading...</div>}>
          <ReviewPageClient
            orderId={orderId}
            orderNumber={order[0].orderNumber}
            productData={productData}
            storeData={storeData}
            isAuthenticated={isAuthenticated}
            userName={session?.user?.name || undefined}
            userEmail={session?.user?.email || undefined}
            hasProductParam={!!listingId}
            hasStoreParam={!!storeId}
          />
        </Suspense>
      </div>
    </div>
  );
}
