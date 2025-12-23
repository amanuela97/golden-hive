"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { discounts, discountTargets, discountCustomers, listing } from "@/db/schema";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import {
  evaluateAmountOffProductsDiscount,
  isDiscountActive,
  isCustomerEligible,
  meetsMinimumRequirements,
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
      minPurchaseQuantity: discount.minPurchaseQuantity,
      customerEligibilityType: discount.customerEligibilityType as
        | "all"
        | "specific",
      targets: discountTargetsArray,
      eligibleCustomerIds,
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
      };
    } else {
      return {
        success: false,
        error: "Either discountId or customDiscount must be provided",
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
