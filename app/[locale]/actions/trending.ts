"use server";

import { db } from "@/db";
import {
  listing,
  orderItems,
  orders,
  listingFavorite,
  store,
  listingTranslations,
  shippingProfiles,
} from "@/db/schema";
import { eq, and, gte, sql, desc, isNotNull, inArray, or } from "drizzle-orm";
import { PublicProduct } from "./public-products";
import { checkShippingAvailability } from "./shipping-availability";

/**
 * Calculate trending score for products
 * Based on: Sales Velocity (40%) + Engagement Growth (30%) + Recency (20%) + Conversion (10%)
 */
export async function getTrendingProducts(
  limit: number = 6,
  locale: string = "en",
  customerCountry?: string
): Promise<PublicProduct[]> {
  try {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all active products from approved stores
    const allProductsRaw = await db
      .select({
        id: listing.id,
        storeId: listing.storeId,
        salesCount: listing.salesCount,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        createdAt: listing.createdAt,
      })
      .from(listing)
      .innerJoin(store, eq(listing.storeId, store.id))
      .where(
        and(
          eq(listing.status, "active"),
          eq(store.isApproved, true),
          eq(store.visibility, "public"),
          // Product must have shipping profile (either direct or store default)
          or(
            isNotNull(listing.shippingProfileId), // Product has direct profile
            // Store has default profile
            sql`EXISTS (
              SELECT 1 FROM ${shippingProfiles} 
              WHERE ${shippingProfiles.storeId} = ${store.id} 
              AND ${shippingProfiles.isDefault} = true
            )`
          )
        )
      );

    if (!allProductsRaw || allProductsRaw.length === 0) {
      return [];
    }

    // Filter and normalize allProducts
    const allProducts = allProductsRaw
      .filter((p) => p.id != null && typeof p.id === "string")
      .map((p) => ({
        id: String(p.id),
        storeId: String(p.storeId),
        salesCount: Number(p.salesCount ?? 0),
        ratingAverage: p.ratingAverage || "0",
        ratingCount: Number(p.ratingCount ?? 0),
        createdAt:
          p.createdAt instanceof Date
            ? p.createdAt
            : p.createdAt
              ? new Date(p.createdAt)
              : new Date(),
      }));

    // Calculate sales velocity (last 7 days vs last 30 days)
    // Using separate queries for better compatibility
    const recentSalesData =
      (await db
        .select({
          listingId: orderItems.listingId,
          count: sql<number>`count(*)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.fulfillmentStatus, "fulfilled"),
            isNotNull(orderItems.listingId),
            gte(orders.createdAt, last7d)
          )
        )
        .groupBy(orderItems.listingId)) || [];

    const baselineSalesData =
      (await db
        .select({
          listingId: orderItems.listingId,
          count: sql<number>`count(*)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.fulfillmentStatus, "fulfilled"),
            isNotNull(orderItems.listingId),
            gte(orders.createdAt, last30d),
            sql`${orders.createdAt} < ${last7d}`
          )
        )
        .groupBy(orderItems.listingId)) || [];

    const recentSalesMap = new Map(
      recentSalesData
        .filter((s) => s.listingId != null)
        .map((s) => [s.listingId!, Number(s.count)])
    );
    const baselineSalesMap = new Map(
      baselineSalesData
        .filter((s) => s.listingId != null)
        .map((s) => [s.listingId!, Number(s.count)])
    );

    // Calculate engagement (favorites in last 7 days)
    const engagementData =
      (await db
        .select({
          listingId: listingFavorite.listingId,
          count: sql<number>`count(*)`,
        })
        .from(listingFavorite)
        .where(gte(listingFavorite.createdAt, last7d))
        .groupBy(listingFavorite.listingId)) || [];

    const engagementMap = new Map(
      engagementData
        .filter((e) => e.listingId != null)
        .map((e) => [e.listingId!, Number(e.count)])
    );

    // Build score map
    const scores = new Map<string, { listingId: string; score: number }>();

    for (const product of allProducts) {
      // Skip products without valid IDs
      if (!product.id) continue;

      // Sales Velocity (40%)
      const recentSales = recentSalesMap.get(product.id) || 0;
      const baselineSales = baselineSalesMap.get(product.id) || 0;
      const salesVelocityScore =
        baselineSales > 0
          ? Math.min((recentSales / baselineSales) * 0.4, 0.4)
          : recentSales > 0
            ? 0.4
            : 0;

      // Engagement Growth (30%)
      const favorites = engagementMap.get(product.id) || 0;
      const engagementScore = Math.min(favorites / 10, 1) * 0.3;

      // Conversion Performance (10%) - based on rating
      const rating = Number(product.ratingAverage || 0);
      const conversionScore = (rating / 5) * 0.1;

      // Recency boost (20%) - newer products get boost
      const productCreatedAt =
        product.createdAt instanceof Date
          ? product.createdAt
          : product.createdAt
            ? new Date(product.createdAt)
            : new Date();
      const daysSinceCreation =
        (now.getTime() - productCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore =
        daysSinceCreation < 7 ? 0.2 : daysSinceCreation < 30 ? 0.1 : 0;

      const totalScore =
        salesVelocityScore + engagementScore + conversionScore + recencyScore;

      scores.set(product.id, {
        listingId: product.id,
        score: totalScore,
      });
    }

    // Sort by score and get top products
    const sorted = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // If we don't have enough trending products, fill with highest sales
    if (sorted.length < limit) {
      const topSales = allProducts
        .filter((p) => !scores.has(p.id))
        .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
        .slice(0, limit - sorted.length);

      for (const product of topSales) {
        scores.set(product.id, {
          listingId: product.id,
          score: Number(product.salesCount || 0) / 100, // Normalize
        });
      }
    }

    // Fetch full product data
    const productIds = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s?.listingId)
      .filter((id): id is string => typeof id === "string" && id !== "");

    if (productIds.length === 0) {
      return [];
    }

    let products;
    try {
      products = await db
        .select({
          id: listing.id,
          slug: listing.slug,
          name: listingTranslations.name,
          description: listingTranslations.description,
          category: listing.taxonomyCategoryId,
          categoryName: listing.taxonomyCategoryName,
          imageUrl: listing.imageUrl,
          gallery: listing.gallery,
          tags: listingTranslations.tags,
          price: listing.price,
          compareAtPrice: listing.compareAtPrice,
          currency: listing.currency,
          unit: listing.unit,
          status: listing.status,
          isFeatured: listing.isFeatured,
          marketType: listing.marketType,
          originVillage: listingTranslations.originVillage,
          harvestDate: listing.harvestDate,
          ratingAverage: listing.ratingAverage,
          ratingCount: listing.ratingCount,
          salesCount: listing.salesCount,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          storeName: store.storeName,
          storeSlug: store.slug,
          nameFallback: listing.name,
          descriptionFallback: listing.description,
          tagsFallback: listing.tags,
          originVillageFallback: listing.originVillage,
        })
        .from(listing)
        .innerJoin(store, eq(listing.storeId, store.id))
        .leftJoin(
          listingTranslations,
          and(
            eq(listingTranslations.listingId, listing.id),
            eq(listingTranslations.locale, locale)
          )
        )
        .where(
          and(
            inArray(listing.id, productIds),
            eq(listing.status, "active"),
            eq(store.isApproved, true),
            eq(store.visibility, "public")
          )
        )
        .orderBy(desc(listing.salesCount));
    } catch (error) {
      console.error("Error fetching trending products:", error);
      return [];
    }

    if (!products || !Array.isArray(products)) {
      return [];
    }

    // Map to PublicProduct format
    const mappedProducts = products
      .filter((p) => p.id != null && typeof p.id === "string")
      .map((p) => {
        // Ensure dates are Date objects or null, never undefined
        const createdAt =
          p.createdAt instanceof Date
            ? p.createdAt
            : p.createdAt
              ? new Date(p.createdAt)
              : new Date();
        const updatedAt =
          p.updatedAt instanceof Date
            ? p.updatedAt
            : p.updatedAt
              ? new Date(p.updatedAt)
              : new Date();
        const harvestDate =
          p.harvestDate instanceof Date
            ? p.harvestDate
            : p.harvestDate
              ? new Date(p.harvestDate)
              : null;

        // Ensure arrays are arrays or null, never undefined
        const gallery =
          Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : null;
        const tags =
          Array.isArray(p.tags) && p.tags.length > 0
            ? p.tags
            : Array.isArray(p.tagsFallback) && p.tagsFallback.length > 0
              ? p.tagsFallback
              : null;

        const product: PublicProduct = {
          id: String(p.id),
          slug: p.slug || null,
          name: String(p.name || p.nameFallback || ""),
          description: p.description || p.descriptionFallback || null,
          category: p.category || null,
          categoryName: p.categoryName || null,
          imageUrl: p.imageUrl || null,
          gallery,
          tags,
          price: String(p.price || "0"),
          compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : null,
          currency: String(p.currency || "NPR"),
          stockQuantity: null,
          unit: p.unit || null,
          isActive: p.status === "active",
          isFeatured: Boolean(p.isFeatured ?? false),
          marketType: p.marketType || null,
          originVillage: p.originVillage || p.originVillageFallback || null,
          harvestDate,
          ratingAverage: String(p.ratingAverage || "0"),
          ratingCount: Number(p.ratingCount ?? 0),
          salesCount: Number(p.salesCount ?? 0),
          createdAt,
          updatedAt,
          storeName: p.storeName || null,
          storeSlug: p.storeSlug || null,
          shippingAvailable: null as boolean | null | undefined, // Will be set below if country provided
        };

        // Validate no undefined values
        for (const key in product) {
          if (product[key as keyof PublicProduct] === undefined) {
            console.warn(
              `Undefined value found in product ${product.id} for key ${key}`
            );
          }
        }

        return product;
      });

    // Check shipping availability if customer country is provided
    let finalProducts = mappedProducts;
    if (customerCountry) {
      const availabilityChecks = await Promise.all(
        mappedProducts.map(async (product) => {
          const availability = await checkShippingAvailability(
            product.id,
            customerCountry
          );
          return {
            ...product,
            shippingAvailable: availability.available,
          };
        })
      );
      finalProducts = availabilityChecks;
    }

    return finalProducts;
  } catch (error) {
    console.error("Error in getTrendingProducts:", error);
    return [];
  }
}
