"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  discounts,
  discountTargets,
  discountCustomers,
  listing,
} from "@/db/schema";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import {
  evaluateAmountOffProductsDiscount,
  evaluateBestDiscountsPerItem,
  isDiscountActive,
  isCustomerEligible,
  meetsMinimumRequirements,
  discountAppliesToItem,
} from "@/lib/utils-discount";
import type {
  CartItem,
  Discount,
  DiscountTarget,
  OrderDiscountResult,
} from "@/lib/types";

async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

/**
 * Get all active discounts without code requirements for public checkout
 * Returns discounts that can be automatically applied
 */
export async function getAutomaticDiscountsForCheckout(
  cartItems: Array<{
    id: string;
    listingId: string;
    variantId?: string | null;
    name: string;
    price: number;
    quantity: number;
  }>,
  customerEmail?: string | null
): Promise<{
  success: boolean;
  discounts?: Array<{
    id: string;
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    minPurchaseAmount: number | null;
    minPurchaseQuantity: number | null;
    customerEligibilityType: "all" | "specific";
    evaluationResult?: {
      totalAmount: number;
      canApply: boolean;
      reason?: string;
      missingAmount?: number;
      missingQuantity?: number;
    };
  }>;
  error?: string;
}> {
  try {
    const now = new Date();

    // Find all active discounts (both with and without codes)
    // We need to check all discounts to see which ones apply to cart items
    const discountData = await db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.isActive, true),
          sql`(${discounts.startsAt} IS NULL OR ${discounts.startsAt} <= ${now})`,
          sql`(${discounts.endsAt} IS NULL OR ${discounts.endsAt} >= ${now})`
        )
      );

    if (discountData.length === 0) {
      return { success: true, discounts: [] };
    }

    // Get discount targets
    const allTargets = await db.select().from(discountTargets);
    const targetsMap = new Map<string, DiscountTarget[]>();
    for (const target of allTargets) {
      if (!targetsMap.has(target.discountId)) {
        targetsMap.set(target.discountId, []);
      }
      const targets = targetsMap.get(target.discountId)!;
      if (target.targetType === "all_products") {
        targets.push({ type: "all_products" });
      } else if (target.targetType === "product_ids" && target.productIds) {
        targets.push({
          type: "listing_ids",
          listingIds: target.productIds as string[],
        });
      }
    }

    // Get eligible customer IDs
    const customerDiscounts = await db
      .select()
      .from(discountCustomers)
      .where(
        inArray(
          discountCustomers.discountId,
          discountData.map((d) => d.id)
        )
      );
    const customerIdsMap = new Map<string, string[]>();
    for (const cd of customerDiscounts) {
      if (!customerIdsMap.has(cd.discountId)) {
        customerIdsMap.set(cd.discountId, []);
      }
      customerIdsMap.get(cd.discountId)!.push(cd.customerId);
    }

    // Get customer ID from email if provided
    let customerId: string | null = null;
    if (customerEmail) {
      const { customers } = await import("@/db/schema");
      const customerData = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, customerEmail))
        .limit(1);
      if (customerData.length > 0) {
        customerId = customerData[0].id;
      }
    }

    // Get storeId for each listing
    const listingIds = cartItems.map((item) => item.listingId);
    const listings = await db
      .select({ id: listing.id, storeId: listing.storeId })
      .from(listing)
      .where(inArray(listing.id, listingIds));

    const listingStoreMap = new Map<string, string | null>();
    for (const l of listings) {
      listingStoreMap.set(l.id, l.storeId);
    }

    // Convert cart items to CartItem format
    const items: CartItem[] = cartItems.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      variantId: item.variantId ?? null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      storeId: listingStoreMap.get(item.listingId) ?? null,
    }));

    // Evaluate each discount
    const evaluatedDiscounts = [];
    for (const discount of discountData) {
      // Build Discount object
      const discountTargetsArray = targetsMap.get(discount.id) || [];
      const eligibleCustomerIds = customerIdsMap.get(discount.id) || [];

      const fullDiscount: Discount = {
        id: discount.id,
        type: discount.type as "amount_off_products",
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency || undefined,
        isActive: discount.isActive,
        startsAt: discount.startsAt || undefined,
        endsAt: discount.endsAt || undefined,
        minPurchaseAmount: discount.minPurchaseAmount
          ? parseFloat(discount.minPurchaseAmount)
          : null,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        customerEligibilityType: discount.customerEligibilityType as
          | "all"
          | "specific",
        targets: discountTargetsArray,
        eligibleCustomerIds,
        ownerType: discount.ownerType as "admin" | "seller",
        ownerId: discount.ownerId || undefined,
      };

      // First check if discount applies to any items in cart (product targeting)
      // Only show discount if it would apply to at least one item
      const appliesToAnyItem = items.some((item) =>
        discountAppliesToItem(fullDiscount, item)
      );

      // If discount doesn't apply to any items, skip it entirely
      if (!appliesToAnyItem) {
        continue;
      }

      // Calculate subtotal and quantity only for items this discount applies to
      const applicableItems = items.filter((item) =>
        discountAppliesToItem(fullDiscount, item)
      );

      const subtotal = applicableItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const totalQuantity = applicableItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      let canApply = true;
      let reason: string | undefined;
      let missingAmount: number | undefined;
      let missingQuantity: number | undefined;

      // Check requirements and eligibility first
      if (!isDiscountActive(fullDiscount)) {
        canApply = false;
        reason = "Discount is not active";
      } else if (!isCustomerEligible(fullDiscount, customerId)) {
        canApply = false;
        reason = "Not eligible for this discount";
      } else if (
        fullDiscount.minPurchaseAmount &&
        subtotal < fullDiscount.minPurchaseAmount
      ) {
        canApply = false;
        reason = `Minimum purchase of ${fullDiscount.currency || "€"}${fullDiscount.minPurchaseAmount} required`;
        missingAmount = fullDiscount.minPurchaseAmount - subtotal;
      } else if (
        fullDiscount.minPurchaseQuantity &&
        totalQuantity < fullDiscount.minPurchaseQuantity
      ) {
        canApply = false;
        reason = `Minimum quantity of ${fullDiscount.minPurchaseQuantity} items required`;
        missingQuantity = fullDiscount.minPurchaseQuantity - totalQuantity;
      }

      // Only evaluate discount if it can apply (meets requirements)
      let result = null;
      if (canApply) {
        result = evaluateAmountOffProductsDiscount(
          items,
          fullDiscount,
          customerId
        );

        if (!result) {
          // This shouldn't happen if appliesToAnyItem is true, but keep as safety check
          canApply = false;
          reason = "Discount does not apply to any items in cart";
        }
      }

      evaluatedDiscounts.push({
        id: discount.id,
        name: discount.name,
        code: discount.code,
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency,
        minPurchaseAmount: discount.minPurchaseAmount
          ? parseFloat(discount.minPurchaseAmount)
          : null,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        customerEligibilityType: discount.customerEligibilityType as
          | "all"
          | "specific",
        evaluationResult: {
          totalAmount: result?.totalAmount || 0,
          canApply,
          reason,
          missingAmount,
          missingQuantity,
        },
      });
    }

    return { success: true, discounts: evaluatedDiscounts };
  } catch (error) {
    console.error("Error getting automatic discounts:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get automatic discounts",
    };
  }
}

/**
 * Get discount by code for public checkout (no auth required)
 * Returns discount details including eligibility and minimum requirements
 */
export async function getDiscountByCodeForCheckout(code: string): Promise<{
  success: boolean;
  discount?: {
    id: string;
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    minPurchaseAmount: number | null;
    minPurchaseQuantity: number | null;
    customerEligibilityType: "all" | "specific";
    eligibleCustomerIds?: string[];
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  };
  error?: string;
}> {
  try {
    const now = new Date();

    // Find discount by code
    const discountData = await db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.code, code),
          eq(discounts.isActive, true),
          sql`(${discounts.startsAt} IS NULL OR ${discounts.startsAt} <= ${now})`,
          sql`(${discounts.endsAt} IS NULL OR ${discounts.endsAt} >= ${now})`
        )
      )
      .limit(1);

    if (discountData.length === 0) {
      return {
        success: false,
        error: "Discount code not found or expired",
      };
    }

    const discount = discountData[0];

    // Get eligible customer IDs if specific eligibility
    let eligibleCustomerIds: string[] | undefined;
    if (discount.customerEligibilityType === "specific") {
      const customerDiscounts = await db
        .select({ customerId: discountCustomers.customerId })
        .from(discountCustomers)
        .where(eq(discountCustomers.discountId, discount.id));
      eligibleCustomerIds = customerDiscounts.map((cd) => cd.customerId);
    }

    return {
      success: true,
      discount: {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency,
        minPurchaseAmount: discount.minPurchaseAmount
          ? parseFloat(discount.minPurchaseAmount)
          : null,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        customerEligibilityType: discount.customerEligibilityType as
          | "all"
          | "specific",
        eligibleCustomerIds,
        isActive: discount.isActive,
        startsAt: discount.startsAt,
        endsAt: discount.endsAt,
      },
    };
  } catch (error) {
    console.error("Error getting discount by code:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get discount",
    };
  }
}

/**
 * Search active discounts for order creation
 */
export async function searchActiveDiscounts(query?: string): Promise<{
  success: boolean;
  discounts?: Array<{
    id: string;
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    minPurchaseAmount: number | null;
    minPurchaseQuantity: number | null;
    appliesTo: string; // "All products" or "X products"
  }>;
  error?: string;
}> {
  try {
    await getCurrentUser();

    const now = new Date();
    const conditions = [
      eq(discounts.isActive, true),
      sql`(${discounts.startsAt} IS NULL OR ${discounts.startsAt} <= ${now})`,
      sql`(${discounts.endsAt} IS NULL OR ${discounts.endsAt} >= ${now})`,
    ];

    if (query) {
      conditions.push(
        or(
          sql`${discounts.name} ILIKE ${`%${query}%`}`,
          sql`${discounts.code} ILIKE ${`%${query}%`}`
        )!
      );
    }

    const allDiscounts = await db
      .select()
      .from(discounts)
      .where(and(...conditions))
      .orderBy(desc(discounts.createdAt));

    // Get discount targets
    const allTargets = await db.select().from(discountTargets);
    const targetsMap = new Map<string, DiscountTarget[]>();
    for (const target of allTargets) {
      if (!targetsMap.has(target.discountId)) {
        targetsMap.set(target.discountId, []);
      }
      const targets = targetsMap.get(target.discountId)!;
      if (target.targetType === "all_products") {
        targets.push({ type: "all_products" });
      } else if (target.targetType === "product_ids" && target.productIds) {
        targets.push({
          type: "listing_ids",
          listingIds: target.productIds as string[],
        });
      }
    }

    // Get product counts
    const productCounts = new Map<string, number>();
    for (const target of allTargets) {
      if (target.targetType === "product_ids" && target.productIds) {
        const ids = target.productIds as string[];
        productCounts.set(target.discountId, ids.length);
      } else if (target.targetType === "all_products") {
        productCounts.set(target.discountId, -1); // -1 means "all products"
      }
    }

    const result = allDiscounts.map((discount) => {
      const productCount = productCounts.get(discount.id);
      const appliesTo =
        productCount === -1
          ? "All products"
          : productCount
            ? `${productCount} products`
            : "No products";

      return {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency,
        minPurchaseAmount: discount.minPurchaseAmount
          ? parseFloat(discount.minPurchaseAmount)
          : null,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        appliesTo,
      };
    });

    return { success: true, discounts: result };
  } catch (error) {
    console.error("Error searching discounts:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search discounts",
    };
  }
}

/**
 * Get discount by ID with full details
 */
export async function getDiscountForOrder(discountId: string): Promise<{
  success: boolean;
  discount?: Discount;
  error?: string;
}> {
  try {
    await getCurrentUser();

    const discountData = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (discountData.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    const discount = discountData[0];

    // Get targets
    const targetRows = await db
      .select()
      .from(discountTargets)
      .where(eq(discountTargets.discountId, discountId));

    const discountTargetsArray: DiscountTarget[] = [];
    for (const target of targetRows) {
      if (target.targetType === "all_products") {
        discountTargetsArray.push({ type: "all_products" });
      } else if (target.targetType === "product_ids" && target.productIds) {
        discountTargetsArray.push({
          type: "listing_ids",
          listingIds: target.productIds as string[],
        });
      }
    }

    // Get eligible customer IDs
    let eligibleCustomerIds: string[] = [];
    if (discount.customerEligibilityType === "specific") {
      const customerDiscounts = await db
        .select({ customerId: discountCustomers.customerId })
        .from(discountCustomers)
        .where(eq(discountCustomers.discountId, discountId));
      eligibleCustomerIds = customerDiscounts.map((cd) => cd.customerId);
    }

    const fullDiscount: Discount = {
      id: discount.id,
      type: discount.type as "amount_off_products",
      valueType: discount.valueType as "fixed" | "percentage",
      value: parseFloat(discount.value),
      currency: discount.currency || undefined,
      isActive: discount.isActive,
      startsAt: discount.startsAt || undefined,
      endsAt: discount.endsAt || undefined,
      minPurchaseAmount: discount.minPurchaseAmount
        ? parseFloat(discount.minPurchaseAmount)
        : null,
      minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
      customerEligibilityType: discount.customerEligibilityType as
        | "all"
        | "specific",
      targets: discountTargetsArray,
      eligibleCustomerIds,
      ownerType: discount.ownerType as "admin" | "seller",
      ownerId: discount.ownerId || null,
    };

    return { success: true, discount: fullDiscount };
  } catch (error) {
    console.error("Error fetching discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch discount",
    };
  }
}

/**
 * Evaluate discount against cart items
 */
/**
 * Find and evaluate the best discount for cart items (public checkout)
 * Evaluates all eligible discounts and returns the best one
 */
export async function findBestDiscountForCheckout(
  cartItems: Array<{
    id: string;
    listingId: string;
    variantId?: string | null;
    name: string;
    price: number;
    quantity: number;
  }>,
  customerEmail?: string | null,
  excludeDiscountId?: string | null,
  excludeDiscountsWithCodes: boolean = false
): Promise<{
  success: boolean;
  bestDiscount?: {
    discountId: string;
    discountName: string;
    discountCode: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    totalAmount: number;
    allocations?: Array<{
      cartItemId: string;
      discountId: string;
      amount: number;
    }>;
    appliedDiscountNames?: string[];
    eligibilityInfo?: {
      customerEligibilityType: "all" | "specific";
      minPurchaseAmount: number | null;
      minPurchaseQuantity: number | null;
    };
  };
  error?: string;
}> {
  try {
    const now = new Date();

    // Get all active discounts
    // If excludeDiscountsWithCodes is true, only get discounts without codes (for auto-apply)
    const conditions = [
      eq(discounts.isActive, true),
      sql`(${discounts.startsAt} IS NULL OR ${discounts.startsAt} <= ${now})`,
      sql`(${discounts.endsAt} IS NULL OR ${discounts.endsAt} >= ${now})`,
    ];

    if (excludeDiscountId) {
      conditions.push(sql`${discounts.id} != ${excludeDiscountId}`);
    }

    if (excludeDiscountsWithCodes) {
      conditions.push(sql`${discounts.code} IS NULL`);
    }

    const discountData = await db
      .select()
      .from(discounts)
      .where(and(...conditions));

    if (discountData.length === 0) {
      return { success: true };
    }

    // Get discount targets, customer eligibility, etc. (similar to getAutomaticDiscountsForCheckout)
    const allTargets = await db.select().from(discountTargets);
    const targetsMap = new Map<string, DiscountTarget[]>();
    for (const target of allTargets) {
      if (!targetsMap.has(target.discountId)) {
        targetsMap.set(target.discountId, []);
      }
      const targets = targetsMap.get(target.discountId)!;
      if (target.targetType === "all_products") {
        targets.push({ type: "all_products" });
      } else if (target.targetType === "product_ids" && target.productIds) {
        targets.push({
          type: "listing_ids",
          listingIds: target.productIds as string[],
        });
      }
    }

    const customerDiscounts = await db
      .select()
      .from(discountCustomers)
      .where(
        inArray(
          discountCustomers.discountId,
          discountData.map((d) => d.id)
        )
      );
    const customerIdsMap = new Map<string, string[]>();
    for (const cd of customerDiscounts) {
      if (!customerIdsMap.has(cd.discountId)) {
        customerIdsMap.set(cd.discountId, []);
      }
      customerIdsMap.get(cd.discountId)!.push(cd.customerId);
    }

    let customerId: string | null = null;
    if (customerEmail) {
      const { customers } = await import("@/db/schema");
      const customerData = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, customerEmail))
        .limit(1);
      if (customerData.length > 0) {
        customerId = customerData[0].id;
      }
    }

    const listingIds = cartItems.map((item) => item.listingId);
    const listings = await db
      .select({ id: listing.id, storeId: listing.storeId })
      .from(listing)
      .where(inArray(listing.id, listingIds));

    const listingStoreMap = new Map<string, string | null>();
    for (const l of listings) {
      listingStoreMap.set(l.id, l.storeId);
    }

    const items: CartItem[] = cartItems.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      variantId: item.variantId ?? null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      storeId: listingStoreMap.get(item.listingId) ?? null,
    }));

    // Build Discount objects for evaluation
    const allDiscounts: Discount[] = [];

    for (const discount of discountData) {
      const discountTargetsArray = targetsMap.get(discount.id) || [];
      const eligibleCustomerIds = customerIdsMap.get(discount.id) || [];

      const fullDiscount: Discount = {
        id: discount.id,
        type: discount.type as "amount_off_products",
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency || undefined,
        isActive: discount.isActive,
        startsAt: discount.startsAt || undefined,
        endsAt: discount.endsAt || undefined,
        minPurchaseAmount: discount.minPurchaseAmount
          ? parseFloat(discount.minPurchaseAmount)
          : null,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        customerEligibilityType: discount.customerEligibilityType as
          | "all"
          | "specific",
        targets: discountTargetsArray,
        eligibleCustomerIds,
        ownerType: discount.ownerType as "admin" | "seller",
        ownerId: discount.ownerId || undefined,
      };

      allDiscounts.push(fullDiscount);
    }

    // Use evaluateBestDiscountsPerItem to find the best discount per item
    // This ensures each item gets its own best discount, even across different stores
    // This is critical for multi-store checkouts where different products should get different discounts
    const bestResult = evaluateBestDiscountsPerItem(
      items,
      allDiscounts,
      customerId
    );

    if (!bestResult || bestResult.allocations.length === 0) {
      return { success: true };
    }

    // Get discount details for the primary discount (the one with most items)
    const primaryDiscountData = discountData.find(
      (d) => d.id === bestResult.discountId
    );

    if (!primaryDiscountData) {
      return { success: true };
    }

    // Get discount names and codes for all discounts used
    const discountNamesMap = new Map<string, string>();
    const discountCodesMap = new Map<string, string | null>();
    const discountValueTypesMap = new Map<string, "fixed" | "percentage">();
    const discountValuesMap = new Map<string, number>();
    const discountCurrenciesMap = new Map<string, string | null>();

    for (const discount of discountData) {
      discountNamesMap.set(discount.id, discount.name);
      discountCodesMap.set(discount.id, discount.code);
      discountValueTypesMap.set(
        discount.id,
        discount.valueType as "fixed" | "percentage"
      );
      discountValuesMap.set(discount.id, parseFloat(discount.value));
      discountCurrenciesMap.set(discount.id, discount.currency);
    }

    // Collect all unique discounts that are applied (from allocations)
    const appliedDiscountIds = new Set<string>();
    for (const allocation of bestResult.allocations) {
      appliedDiscountIds.add(allocation.discountId);
    }

    // Get all discount names that are applied
    const appliedDiscountNames = Array.from(appliedDiscountIds).map(
      (id) => discountNamesMap.get(id) || "Unknown Discount"
    );

    // Find the discount that gives the highest total savings (primary discount)
    // But note: different items might have different discounts applied
    // The totalAmount in bestResult is the sum of all discounts applied to all items
    const bestEvaluation = {
      discount: allDiscounts.find((d) => d.id === bestResult.discountId)!,
      result: bestResult,
      discountName: primaryDiscountData.name,
      discountCode: primaryDiscountData.code,
    };

    return {
      success: true,
      bestDiscount: {
        discountId: bestEvaluation.discount.id,
        discountName:
          appliedDiscountNames.length > 1
            ? appliedDiscountNames.join(", ")
            : bestEvaluation.discountName,
        discountCode: bestEvaluation.discountCode,
        valueType: bestEvaluation.discount.valueType,
        value: bestEvaluation.discount.value,
        currency: bestEvaluation.discount.currency || null,
        totalAmount: bestEvaluation.result!.totalAmount,
        allocations: bestResult.allocations,
        appliedDiscountNames: appliedDiscountNames,
        eligibilityInfo: {
          customerEligibilityType:
            bestEvaluation.discount.customerEligibilityType,
          minPurchaseAmount: bestEvaluation.discount.minPurchaseAmount ?? null,
          minPurchaseQuantity:
            bestEvaluation.discount.minPurchaseQuantity ?? null,
        },
      },
    };
  } catch (error) {
    console.error("Error finding best discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to find best discount",
    };
  }
}

/**
 * Evaluate discount for public checkout (no auth required)
 */
export async function evaluateDiscountForCheckout(
  discountId: string,
  cartItems: Array<{
    id: string;
    listingId: string;
    variantId?: string | null;
    name: string;
    price: number;
    quantity: number;
  }>,
  customerEmail?: string | null
): Promise<{
  success: boolean;
  result?: OrderDiscountResult & {
    discountName: string;
    discountCode: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
  };
  error?: string;
  validationError?: string;
  eligibilityInfo?: {
    customerEligibilityType: "all" | "specific";
    minPurchaseAmount: number | null;
    minPurchaseQuantity: number | null;
  };
}> {
  try {
    // Get discount by ID (no auth required for checkout)
    const discountResult = await getDiscountForOrderPublic(discountId);
    if (!discountResult.success || !discountResult.discount) {
      return {
        success: false,
        error: discountResult.error || "Discount not found",
      };
    }
    const discount = discountResult.discount;

    // Get storeId for each listing (needed for ownership checking)
    const listingIds = cartItems.map((item) => item.listingId);
    const listings = await db
      .select({ id: listing.id, storeId: listing.storeId })
      .from(listing)
      .where(inArray(listing.id, listingIds));

    const listingStoreMap = new Map<string, string | null>();
    for (const l of listings) {
      listingStoreMap.set(l.id, l.storeId);
    }

    // Convert cart items to CartItem format
    const items: CartItem[] = cartItems.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      variantId: item.variantId ?? null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      storeId: listingStoreMap.get(item.listingId) ?? null,
    }));

    // Get customer ID from email if provided (for eligibility checking)
    let customerId: string | null = null;
    if (customerEmail) {
      // Try to find customer by email
      const { customers } = await import("@/db/schema");
      const customerData = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, customerEmail))
        .limit(1);
      if (customerData.length > 0) {
        customerId = customerData[0].id;
      }
    }

    // Validate discount is active
    if (!isDiscountActive(discount)) {
      return {
        success: false,
        validationError: "Discount is not active",
      };
    }

    // Validate customer eligibility
    if (!isCustomerEligible(discount, customerId)) {
      return {
        success: false,
        validationError: "Customer is not eligible for this discount",
        eligibilityInfo: {
          customerEligibilityType: discount.customerEligibilityType,
          minPurchaseAmount: discount.minPurchaseAmount ?? null,
          minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
        },
      };
    }

    // Validate minimum requirements
    if (!meetsMinimumRequirements(discount, items)) {
      const minAmount = discount.minPurchaseAmount;
      const minQuantity = discount.minPurchaseQuantity;
      if (minAmount) {
        return {
          success: false,
          validationError: `Minimum purchase of ${discount.currency || ""} ${minAmount} not met`,
          eligibilityInfo: {
            customerEligibilityType: discount.customerEligibilityType,
            minPurchaseAmount: discount.minPurchaseAmount ?? null,
            minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
          },
        };
      }
      if (minQuantity) {
        return {
          success: false,
          validationError: `Minimum quantity of ${minQuantity} items not met`,
          eligibilityInfo: {
            customerEligibilityType: discount.customerEligibilityType,
            minPurchaseAmount: discount.minPurchaseAmount ?? null,
            minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
          },
        };
      }
      return {
        success: false,
        validationError: "Minimum purchase requirements not met",
        eligibilityInfo: {
          customerEligibilityType: discount.customerEligibilityType,
          minPurchaseAmount: discount.minPurchaseAmount ?? null,
          minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
        },
      };
    }

    // Evaluate discount
    const result = evaluateAmountOffProductsDiscount(
      items,
      discount,
      customerId
    );

    if (!result) {
      return {
        success: false,
        validationError: "Discount does not apply to any items in the cart",
        eligibilityInfo: {
          customerEligibilityType: discount.customerEligibilityType,
          minPurchaseAmount: discount.minPurchaseAmount ?? null,
          minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
        },
      };
    }

    // Get discount name and code from database
    const discountData = await db
      .select({ name: discounts.name, code: discounts.code })
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    let discountName = "Discount";
    let discountCode: string | null = null;
    if (discountData.length > 0) {
      discountName = discountData[0].name;
      discountCode = discountData[0].code;
    }

    return {
      success: true,
      result: {
        ...result,
        discountName,
        discountCode,
        valueType: discount.valueType,
        value: discount.value,
        currency: discount.currency || null,
        allocations: result.allocations, // Include allocations for per-item discount application
      },
      eligibilityInfo: {
        customerEligibilityType: discount.customerEligibilityType,
        minPurchaseAmount: discount.minPurchaseAmount ?? null,
        minPurchaseQuantity: discount.minPurchaseQuantity ?? null,
      },
    };
  } catch (error) {
    console.error("Error evaluating discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to evaluate discount",
    };
  }
}

/**
 * Get discount by ID for public checkout (no auth required)
 */
async function getDiscountForOrderPublic(discountId: string): Promise<{
  success: boolean;
  discount?: Discount;
  error?: string;
}> {
  try {
    const discountData = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (discountData.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    const discount = discountData[0];

    // Get targets
    const targetRows = await db
      .select()
      .from(discountTargets)
      .where(eq(discountTargets.discountId, discountId));

    const discountTargetsArray: DiscountTarget[] = [];
    for (const target of targetRows) {
      if (target.targetType === "all_products") {
        discountTargetsArray.push({ type: "all_products" });
      } else if (target.targetType === "product_ids" && target.productIds) {
        discountTargetsArray.push({
          type: "listing_ids",
          listingIds: target.productIds as string[],
        });
      }
    }

    // Get eligible customer IDs
    let eligibleCustomerIds: string[] = [];
    if (discount.customerEligibilityType === "specific") {
      const customerDiscounts = await db
        .select({ customerId: discountCustomers.customerId })
        .from(discountCustomers)
        .where(eq(discountCustomers.discountId, discountId));
      eligibleCustomerIds = customerDiscounts.map((cd) => cd.customerId);
    }

    const fullDiscount: Discount = {
      id: discount.id,
      type: discount.type as "amount_off_products",
      valueType: discount.valueType as "fixed" | "percentage",
      value: parseFloat(discount.value),
      currency: discount.currency || undefined,
      isActive: discount.isActive,
      startsAt: discount.startsAt || undefined,
      endsAt: discount.endsAt || undefined,
      minPurchaseAmount: discount.minPurchaseAmount
        ? parseFloat(discount.minPurchaseAmount)
        : null,
      minPurchaseQuantity: discount.minPurchaseQuantity,
      customerEligibilityType: discount.customerEligibilityType as
        | "all"
        | "specific",
      targets: discountTargetsArray,
      eligibleCustomerIds,
      ownerType: discount.ownerType as "admin" | "seller",
      ownerId: discount.ownerId || undefined,
    };

    return { success: true, discount: fullDiscount };
  } catch (error) {
    console.error("Error fetching discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch discount",
    };
  }
}

export async function evaluateDiscount(
  discountId: string | null,
  customDiscount: {
    valueType: "fixed" | "percentage";
    value: number;
    currency?: string | null;
    targets:
      | { type: "all_products" }
      | { type: "listing_ids"; listingIds: string[] };
  } | null,
  cartItems: Array<{
    id: string;
    listingId: string;
    variantId?: string | null;
    name: string;
    price: number;
    quantity: number;
  }>,
  customerId?: string | null
): Promise<{
  success: boolean;
  result?: OrderDiscountResult & {
    discountName: string;
    discountCode: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
  };
  error?: string;
  validationError?: string;
}> {
  try {
    await getCurrentUser();

    // Get storeId for each listing (needed for ownership checking)
    const listingIds = cartItems.map((item) => item.listingId);
    const listings = await db
      .select({ id: listing.id, storeId: listing.storeId })
      .from(listing)
      .where(inArray(listing.id, listingIds));

    const listingStoreMap = new Map<string, string | null>();
    for (const l of listings) {
      listingStoreMap.set(l.id, l.storeId);
    }

    // Convert cart items to CartItem format
    const items: CartItem[] = cartItems.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      variantId: item.variantId ?? null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      storeId: listingStoreMap.get(item.listingId) ?? null,
    }));

    let discount: Discount;

    if (discountId && !customDiscount) {
      // Existing discount
      const discountResult = await getDiscountForOrder(discountId);
      if (!discountResult.success || !discountResult.discount) {
        return {
          success: false,
          error: discountResult.error || "Discount not found",
        };
      }
      discount = discountResult.discount;

      // Validate discount is active
      if (!isDiscountActive(discount)) {
        return {
          success: false,
          validationError: "Discount is not active",
        };
      }

      // Validate customer eligibility
      if (!isCustomerEligible(discount, customerId)) {
        return {
          success: false,
          validationError: "Customer is not eligible for this discount",
        };
      }

      // Validate minimum requirements
      if (!meetsMinimumRequirements(discount, items)) {
        const minAmount = discount.minPurchaseAmount;
        const minQuantity = discount.minPurchaseQuantity;
        if (minAmount) {
          return {
            success: false,
            validationError: `Minimum purchase of ${discount.currency || ""} ${minAmount} not met`,
          };
        }
        if (minQuantity) {
          return {
            success: false,
            validationError: `Minimum quantity of ${minQuantity} items not met`,
          };
        }
        return {
          success: false,
          validationError: "Minimum purchase requirements not met",
        };
      }
    } else if (customDiscount) {
      // Custom discount - create temporary discount object
      discount = {
        id: "custom", // Temporary ID
        type: "amount_off_products",
        valueType: customDiscount.valueType,
        value: customDiscount.value,
        currency: customDiscount.currency || undefined,
        isActive: true,
        startsAt: undefined,
        endsAt: undefined,
        minPurchaseAmount: null,
        minPurchaseQuantity: null,
        customerEligibilityType: "all",
        targets: [customDiscount.targets],
        eligibleCustomerIds: [],
        ownerType: "admin",
        ownerId: null,
      };
    } else {
      return {
        success: false,
        error: "Either discountId or customDiscount must be provided",
      };
    }

    // Evaluate discount
    // NOTE: This evaluates a single discount. Only one discount is applied per product item.
    // If multiple discounts are eligible, the caller should evaluate all and select the best one.
    // This prevents discount stacking and ensures only the best discount is applied per item.
    const result = evaluateAmountOffProductsDiscount(
      items,
      discount,
      customerId
    );

    if (!result) {
      return {
        success: false,
        validationError: "Discount does not apply to any items in the cart",
      };
    }

    // Get discount name and code from database if it's an existing discount
    let discountName = "Custom discount";
    let discountCode: string | null = null;

    if (discountId && !customDiscount) {
      const discountData = await db
        .select({ name: discounts.name, code: discounts.code })
        .from(discounts)
        .where(eq(discounts.id, discountId))
        .limit(1);

      if (discountData.length > 0) {
        discountName = discountData[0].name;
        discountCode = discountData[0].code;
      }
    }

    return {
      success: true,
      result: {
        ...result,
        discountName,
        discountCode,
        valueType: discount.valueType,
        value: discount.value,
        currency: discount.currency || null,
      },
    };
  } catch (error) {
    console.error("Error evaluating discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to evaluate discount",
    };
  }
}
