"use server";

import { db } from "@/db";
import {
  listing,
  listingTranslations,
  listingVariants,
  inventoryItems,
  inventoryLevels,
  store,
  shippingProfiles,
} from "@/db/schema";
import { eq, and, desc, inArray, sql, or, isNotNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { checkShippingAvailability } from "./shipping-availability";

export interface PublicProduct {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  gallery: string[] | null;
  tags: string[] | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  stockQuantity: number | null;
  unit: string | null;
  isActive: boolean | null;
  isFeatured: boolean | null;
  marketType: "local" | "international" | null;
  originVillage: string | null;
  harvestDate: Date | null;
  ratingAverage: string | null;
  ratingCount: number | null;
  salesCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  storeName: string | null;
  storeSlug: string | null;
  shippingAvailable?: boolean | null; // Shipping availability for customer's country
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tags?: string[];
  isFeatured?: boolean;
  sortBy?: "name" | "price" | "createdAt" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

// Get all public products with optional filtering
export async function getPublicProducts(options?: {
  locale?: string;
  categoryIds?: string[];
  limit?: number;
  page?: number;
  customerCountry?: string; // Optional country code for shipping availability check
}): Promise<
  ActionResponse & {
    result?: PublicProduct[];
    total?: number;
    totalPages?: number;
    currentPage?: number;
  }
> {
  const locale = options?.locale || "en";
  const limit = options?.limit || 1000;
  const page = options?.page || 1;
  const offset = (page - 1) * limit;
  try {
    console.log("Fetching all public products...", { locale });

    // Ensure locale is valid
    const validLocale = locale || "en";

    // First, check what listings exist and their statuses (for debugging)
    const allListings = await db
      .select({
        id: listing.id,
        name: listing.name,
        status: listing.status,
      })
      .from(listing)
      .limit(10);

    console.log(`Total listings in database: ${allListings.length}`);
    if (allListings.length > 0) {
      const statusCounts = allListings.reduce(
        (acc, l) => {
          acc[l.status || "null"] = (acc[l.status || "null"] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      console.log("Status distribution:", statusCounts);
    }

    // Build where conditions for both count and select queries
    // Ensure categoryIds is always an array
    const categoryIds = options?.categoryIds
      ? Array.isArray(options.categoryIds)
        ? options.categoryIds
        : [options.categoryIds]
      : undefined;

    const whereConditions = and(
      eq(listing.status, "active"),
      eq(store.isApproved, true), // Only show products from approved stores
      // Product must have shipping profile (either direct or store default)
      or(
        isNotNull(listing.shippingProfileId), // Product has direct profile
        // Store has default profile (checked via subquery in having clause)
        sql`EXISTS (
          SELECT 1 FROM ${shippingProfiles} 
          WHERE ${shippingProfiles.storeId} = ${store.id} 
          AND ${shippingProfiles.isDefault} = true
        )`
      ),
      categoryIds && categoryIds.length > 0
        ? inArray(listing.taxonomyCategoryId, categoryIds)
        : undefined
    );

    // Get total count of products (before pagination)
    // Need to join store table for the count query too
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(listing)
      .leftJoin(store, eq(listing.storeId, store.id))
      .where(whereConditions);

    const total = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Get all active products with category information and translations
    // Note: Only show "active" status products to public
    const products = await db
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
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Store information
        storeName: store.storeName,
        storeSlug: store.slug,
        // Fallback fields from base table
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, validLocale)
        )
      )
      .leftJoin(store, eq(listing.storeId, store.id))
      .where(whereConditions)
      .orderBy(desc(listing.createdAt))
      .limit(limit)
      .offset(offset);

    console.log("Active products fetched:", products.length);

    // Map products with proper type handling
    const mappedProducts = products.map((p) => ({
      id: p.id,
      slug: p.slug || null,
      name: p.name || p.nameFallback || "",
      description: p.description || p.descriptionFallback,
      category: p.category,
      categoryName: p.categoryName,
      imageUrl: p.imageUrl,
      gallery: p.gallery,
      tags: p.tags || p.tagsFallback,
      price: p.price || "0", // Ensure price is always a string
      compareAtPrice: p.compareAtPrice,
      currency: p.currency || "NPR",
      stockQuantity: null, // Stock quantity is calculated from inventory levels
      unit: p.unit || "kg",
      isActive: p.status === "active", // Compare status field
      isFeatured: p.isFeatured ?? false,
      marketType: p.marketType,
      originVillage: p.originVillage || p.originVillageFallback,
      harvestDate: p.harvestDate,
      ratingAverage: p.ratingAverage || "0",
      ratingCount: p.ratingCount ?? 0,
      salesCount: p.salesCount ?? 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      storeName: p.storeName,
      storeSlug: p.storeSlug,
      shippingAvailable: null as boolean | null | undefined, // Will be set below if country provided
    }));

    // Check shipping availability if customer country is provided
    let finalProducts = mappedProducts;
    const customerCountry = options?.customerCountry;
    if (customerCountry) {
      console.log(
        `Checking shipping availability for ${mappedProducts.length} products to country: ${customerCountry}`
      );
      // Check availability for each product in parallel
      const availabilityChecks = await Promise.all(
        mappedProducts.map(async (product) => {
          const availability = await checkShippingAvailability(
            product.id,
            customerCountry
          );
          if (!availability.available) {
            console.log(
              `Product ${product.name} (${product.id}) not available to ${customerCountry}: ${availability.message}`
            );
          }
          return {
            ...product,
            shippingAvailable: availability.available,
          };
        })
      );
      finalProducts = availabilityChecks;
      const unavailableCount = availabilityChecks.filter(
        (p) => p.shippingAvailable === false
      ).length;
      console.log(
        `Shipping check complete: ${unavailableCount} products not available to ${options.customerCountry}`
      );
    }

    console.log("Mapped products:", finalProducts.length);

    return {
      success: true,
      result: finalProducts,
      total,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching public products:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch products",
    };
  }
}

// Get a single public product by slug
export async function getPublicProductBySlug(
  slug: string,
  locale: string = "en",
  options?: { customerCountry?: string }
): Promise<ActionResponse & { result?: PublicProduct }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";
    const slugLower = slug.toLowerCase();

    // Cache key for this product (include country if provided)
    const cacheKey = `product-${slugLower}-${validLocale}-${options?.customerCountry || "all"}`;

    // Use unstable_cache for performance
    return await unstable_cache(
      async () => {
        return await fetchProductBySlug(
          slugLower,
          validLocale,
          options?.customerCountry
        );
      },
      [cacheKey],
      {
        revalidate: 3600, // 1 hour cache
        tags: [`product-${slugLower}`, "products"],
      }
    )();
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
  }
}

// Internal function to fetch product (used by cache)
async function fetchProductBySlug(
  slugLower: string,
  validLocale: string,
  customerCountry?: string
): Promise<ActionResponse & { result?: PublicProduct }> {
  try {
    const result = await db
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
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Store information
        storeName: store.storeName,
        storeSlug: store.slug,
        // Fallback fields
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, validLocale)
        )
      )
      .leftJoin(store, eq(listing.storeId, store.id))
      .where(
        and(
          eq(listing.slugLower, slugLower),
          eq(listing.status, "active"),
          eq(store.isApproved, true),
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
      )
      .limit(1);

    if (result.length === 0) {
      // Try checking slug history for redirects
      const { listingSlugHistory } = await import("@/db/schema");
      const slugHistory = await db
        .select({ listingId: listingSlugHistory.listingId })
        .from(listingSlugHistory)
        .where(eq(listingSlugHistory.slugLower, slugLower))
        .limit(1);

      if (slugHistory.length > 0) {
        // Found in history, fetch by ID
        const historyResult = await db
          .select({
            id: listing.id,
            slug: listing.slug,
            slugLower: listing.slugLower,
          })
          .from(listing)
          .where(eq(listing.id, slugHistory[0].listingId))
          .limit(1);

        if (historyResult.length > 0) {
          // Redirect to current slug
          return {
            success: false,
            error: "Product moved",
            result: {
              redirect: `/products/${historyResult[0].slug}`,
            } as PublicProduct & { redirect: string },
          };
        }
      }

      return {
        success: false,
        error: "Product not found",
      };
    }

    const p = result[0];

    // Check shipping availability if customer country is provided
    let shippingAvailable: boolean | null = null;
    if (customerCountry) {
      const availability = await checkShippingAvailability(
        p.id,
        customerCountry
      );
      shippingAvailable = availability.available;
    }

    return {
      success: true,
      result: {
        id: p.id,
        slug: p.slug || null,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        storeName: p.storeName,
        storeSlug: p.storeSlug,
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        shippingAvailable,
      },
    };
  } catch (error) {
    console.error("Error fetching public product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
  }
}

// Get related products (same category, excluding current product)
export async function getRelatedProducts(
  productId: string,
  categoryId: string | null,
  locale: string = "en",
  limit: number = 4
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";

    // Cache related products for 1 hour
    const cacheKey = `related-products-${productId}-${categoryId || "none"}-${validLocale}-${limit}`;

    return await unstable_cache(
      async () => {
        return await fetchRelatedProducts(
          productId,
          categoryId,
          validLocale,
          limit
        );
      },
      [cacheKey],
      {
        revalidate: 3600, // 1 hour cache
        tags: [`related-products-${productId}`, "products"],
      }
    )();
  } catch (error) {
    console.error("Error fetching related products:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch related products",
    };
  }
}

// Internal function to fetch related products (used by cache)
async function fetchRelatedProducts(
  productId: string,
  categoryId: string | null,
  validLocale: string,
  limit: number
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Build where conditions
    const whereConditions = [
      eq(listing.status, "active"),
      eq(store.isApproved, true),
      // Product must have shipping profile (either direct or store default)
      or(
        isNotNull(listing.shippingProfileId), // Product has direct profile
        // Store has default profile
        sql`EXISTS (
          SELECT 1 FROM ${shippingProfiles} 
          WHERE ${shippingProfiles.storeId} = ${store.id} 
          AND ${shippingProfiles.isDefault} = true
        )`
      ),
    ];

    if (categoryId) {
      whereConditions.push(eq(listing.taxonomyCategoryId, categoryId));
    }

    const query = db
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
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Store information
        storeName: store.storeName,
        storeSlug: store.slug,
        // Fallback fields
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, validLocale)
        )
      )
      .leftJoin(store, eq(listing.storeId, store.id))
      .where(and(...whereConditions))
      .orderBy(desc(listing.createdAt))
      .limit(limit + 1); // Get one extra to account for filtering

    const products = await query;

    // Filter out the current product and map with fallbacks
    const relatedProducts = products
      .filter((product) => product.id !== productId)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        slug: p.slug || null,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        storeName: p.storeName,
        storeSlug: p.storeSlug,
      }));

    return {
      success: true,
      result: relatedProducts,
    };
  } catch (error) {
    console.error("Error fetching related products:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch related products",
    };
  }
}

// Get featured products
export async function getFeaturedProducts(
  locale: string = "en",
  limit: number = 8
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";

    const products = await db
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
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Store information
        storeName: store.storeName,
        storeSlug: store.slug,
        // Fallback fields
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, validLocale)
        )
      )
      .leftJoin(store, eq(listing.storeId, store.id))
      .where(
        and(
          eq(listing.status, "active"),
          eq(listing.isFeatured, true),
          eq(store.isApproved, true),
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
      )
      .orderBy(desc(listing.createdAt))
      .limit(limit);

    return {
      success: true,
      result: products.map((p) => ({
        id: p.id,
        slug: p.slug || null,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null,
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        storeName: p.storeName,
        storeSlug: p.storeSlug,
      })),
    };
  } catch (error) {
    console.error("Error fetching featured products:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch featured products",
    };
  }
}

// Get variants for a public product
export async function getPublicProductVariants(listingId: string): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string | null;
      currency: string | null;
      compareAtPrice: string | null;
      imageUrl: string | null;
      options: Record<string, string> | null;
      available: number | null;
    }>;
  }
> {
  try {
    // Cache variants for 1 hour
    const cacheKey = `product-variants-${listingId}`;

    return await unstable_cache(
      async () => {
        return await fetchProductVariants(listingId);
      },
      [cacheKey],
      {
        revalidate: 3600, // 1 hour cache
        tags: [`product-variants-${listingId}`, "products"],
      }
    )();
  } catch (error) {
    console.error("Error fetching public product variants:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch variants",
    };
  }
}

// Internal function to fetch variants (used by cache)
async function fetchProductVariants(listingId: string): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string | null;
      currency: string | null;
      compareAtPrice: string | null;
      imageUrl: string | null;
      options: Record<string, string> | null;
      available: number | null;
    }>;
  }
> {
  try {
    const variantRows = await db
      .select({
        id: listingVariants.id,
        title: listingVariants.title,
        sku: listingVariants.sku,
        price: listingVariants.price,
        currency: listingVariants.currency,
        compareAtPrice: listingVariants.compareAtPrice,
        imageUrl: listingVariants.imageUrl,
        options: listingVariants.options,
        available: inventoryLevels.available,
      })
      .from(listingVariants)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.variantId, listingVariants.id)
      )
      .leftJoin(
        inventoryLevels,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .where(eq(listingVariants.listingId, listingId))
      .orderBy(listingVariants.createdAt);

    // Aggregate available across locations (one variant can have multiple inventory levels)
    const variantMap = new Map<
      string,
      (typeof variantRows)[0] & { availableSum: number }
    >();
    for (const v of variantRows) {
      const avail = v.available ?? 0;
      const existing = variantMap.get(v.id);
      if (!existing) {
        variantMap.set(v.id, { ...v, availableSum: avail });
      } else {
        existing.availableSum += avail;
      }
    }

    return {
      success: true,
      result: Array.from(variantMap.values()).map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price,
        currency: v.currency,
        compareAtPrice: v.compareAtPrice,
        imageUrl: v.imageUrl,
        options: (v.options as Record<string, string> | null) || null,
        available: v.availableSum,
      })),
    };
  } catch (error) {
    console.error("Error fetching public product variants:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch variants",
    };
  }
}

/**
 * Validate inventory before adding to cart. Returns current available so we don't rely on stale cache.
 */
export async function validateInventoryForCartItem(
  listingId: string,
  variantId: string | null,
  quantity: number
): Promise<{
  success: boolean;
  allowed: boolean;
  available?: number;
  error?: string;
}> {
  try {
    if (!listingId || quantity < 1) {
      return { success: true, allowed: false, available: 0, error: "Invalid request" };
    }

    const whereVariant = variantId
      ? and(
          eq(listingVariants.listingId, listingId),
          eq(listingVariants.id, variantId)
        )
      : eq(listingVariants.listingId, listingId);

    const rows = await db
      .select({
        variantId: listingVariants.id,
        available: inventoryLevels.available,
      })
      .from(listingVariants)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.variantId, listingVariants.id)
      )
      .leftJoin(
        inventoryLevels,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .where(whereVariant);

    // Sum available per variant (same variant can have multiple locations)
    const variantSums = new Map<string, number>();
    for (const r of rows) {
      const avail = r.available ?? 0;
      const id = r.variantId ?? "";
      variantSums.set(id, (variantSums.get(id) ?? 0) + avail);
    }

    // Total available: if specific variant, use that; else sum all variants for listing
    let totalAvailable = 0;
    if (variantId) {
      totalAvailable = variantSums.get(variantId) ?? 0;
    } else {
      for (const sum of variantSums.values()) {
        totalAvailable += sum;
      }
    }

    const allowed = totalAvailable >= quantity;
    return {
      success: true,
      allowed,
      available: totalAvailable,
      error: allowed ? undefined : "Insufficient stock",
    };
  } catch (error) {
    console.error("Error validating inventory:", error);
    return {
      success: false,
      allowed: false,
      error: error instanceof Error ? error.message : "Failed to check inventory",
    };
  }
}
