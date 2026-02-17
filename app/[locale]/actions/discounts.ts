"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  discounts,
  discountTargets,
  discountCustomers,
  orderDiscounts,
  storeMembers,
  listing,
  orders,
  orderItems,
  customers,
} from "@/db/schema";
import { eq, and, or, sql, inArray, ne, desc } from "drizzle-orm";
import { getUserRole } from "@/lib/user-role";
import {
  CreateAmountOffProductsDiscountSchema,
  UpdateDiscountSchema,
  ToggleDiscountSchema,
  ListDiscountsQuerySchema,
  type CreateAmountOffProductsDiscountInput,
  type UpdateDiscountInput,
} from "@/validations/discount.schema";
import { z } from "zod";

// ActionResult type from lib/types.ts
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues?: unknown };

async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

async function checkDiscountPermission(
  discountId: string | null = null
): Promise<{ isAdmin: boolean; storeId: string | null; error?: string }> {
  const user = await getCurrentUser();
  const { roleName, error: roleError } = await getUserRole(user.id);

  if (roleError || !roleName) {
    return { isAdmin: false, storeId: null, error: "Unauthorized" };
  }

  const isAdmin = roleName === "admin";

  // Admins can access all discounts
  if (isAdmin) {
    return { isAdmin: true, storeId: null };
  }

  // Sellers can only access their own store's discounts
  // For now, we'll allow sellers to create discounts (store association can be added later)
  // If checking a specific discount, verify ownership
  if (discountId) {
    // TODO: Add store association to discounts table if needed
    // For now, sellers can manage all discounts they created
  }

  // Get store ID for sellers
  const storeData = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, user.id))
    .limit(1);

  const storeId = storeData.length > 0 ? storeData[0].storeId : null;

  return { isAdmin, storeId };
}

// Types CreateAmountOffProductsDiscountInput and UpdateDiscountInput are in @/validations/discount.schema
// (not re-exported here to avoid Next.js server-actions bundle treating them as runtime exports)

export interface DiscountWithDetails {
  id: string;
  name: string;
  code: string | null;
  type: string;
  valueType: string;
  value: string;
  currency: string | null;
  appliesOncePerOrder: boolean;
  usageLimit: number | null;
  usageCount: number;
  minPurchaseAmount: string | null;
  minPurchaseQuantity: number | null;
  customerEligibilityType: string;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  status: "active" | "scheduled" | "expired" | "disabled";
  appliesTo: string; // "All products" or "X products"
  usage: string; // "X / Y" or "X / ∞"
  activeDates: string; // "Jun 1 – Jun 30" or "—"
  productCount?: number;
  customerCount?: number;
}

/**
 * List discounts (for `/discounts` page)
 */
export async function listDiscounts(rawQuery: unknown): Promise<
  ActionResult<{
    discounts: Array<{
      id: string;
      name: string;
      type: "amount_off_products";
      valueType: "fixed" | "percentage";
      value: number;
      currency: string | null;
      isActive: boolean;
      startsAt: Date | null;
      endsAt: Date | null;
      usageLimit: number | null;
      usageCount: number;
      status: "active" | "scheduled" | "expired" | "disabled";
      appliesTo: string;
      usage: string;
      activeDates: string;
    }>;
  }>
> {
  const parsed = ListDiscountsQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid query params",
      issues: parsed.error.flatten(),
    };
  }

  const { status, q, limit = 50 } = parsed.data;
  try {
    await getCurrentUser();
    const { isAdmin, storeId } = await checkDiscountPermission();

    // Build conditions array
    const conditions: ReturnType<typeof and>[] = [];

    // Enforce role-based visibility (per inst.md)
    if (!isAdmin && storeId) {
      // Sellers only see discounts they own (ownerType = "seller" AND ownerId = storeId)
      // OR discounts that target their specific products
      const ownershipCondition = and(
        eq(discounts.ownerType, "seller"),
        eq(discounts.ownerId, storeId)
      );

      // Also include discounts that target specific products from this store
      const storeProducts = await db
        .select({ id: listing.id })
        .from(listing)
        .where(eq(listing.storeId, storeId));

      const storeProductIds = storeProducts.map((p) => p.id);

      if (storeProductIds.length === 0) {
        // Seller has no products, only show discounts they own
        conditions.push(ownershipCondition);
      } else {
        // Get discount IDs that target products from this store
        const allTargets = await db.select().from(discountTargets);
        const relevantDiscountIds = new Set<string>();

        for (const target of allTargets) {
          // Skip discounts that apply to all products (unless owned by this seller)
          if (target.targetType === "all_products") {
            continue;
          }

          // Check if this discount targets any products from this store
          if (target.targetType === "product_ids" && target.productIds) {
            const productIds = target.productIds as string[];
            const hasStoreProduct = productIds.some((pid) =>
              storeProductIds.includes(pid)
            );

            if (hasStoreProduct) {
              relevantDiscountIds.add(target.discountId);
            }
          }
        }

        // Combine: seller-owned discounts OR discounts targeting seller's products
        if (relevantDiscountIds.size > 0) {
          conditions.push(
            or(
              ownershipCondition,
              inArray(discounts.id, Array.from(relevantDiscountIds))
            )
          );
        } else {
          conditions.push(ownershipCondition);
        }
      }
    }

    // Apply search filter
    if (q) {
      conditions.push(
        or(
          sql`${discounts.name} ILIKE ${`%${q}%`}`,
          sql`${discounts.code} ILIKE ${`%${q}%`}`
        )
      );
    }

    // Apply status filter
    const nowTime = new Date();
    if (status && status !== "all") {
      if (status === "active") {
        conditions.push(
          and(
            eq(discounts.isActive, true),
            sql`(${discounts.startsAt} IS NULL OR ${discounts.startsAt} <= ${nowTime})`,
            sql`(${discounts.endsAt} IS NULL OR ${discounts.endsAt} >= ${nowTime})`
          )
        );
      } else if (status === "scheduled") {
        conditions.push(
          and(
            eq(discounts.isActive, true),
            sql`${discounts.startsAt} > ${nowTime}`
          )
        );
      } else if (status === "expired") {
        conditions.push(
          and(
            eq(discounts.isActive, true),
            sql`${discounts.endsAt} < ${nowTime}`
          )
        );
      } else if (status === "disabled") {
        conditions.push(eq(discounts.isActive, false));
      }
    }

    // Build and execute query
    const baseQuery = db.select().from(discounts);
    const queryWithConditions =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    // Fetch discounts (type assertion needed due to Drizzle ORM type inference limitations)
    const allDiscounts = await (queryWithConditions as typeof baseQuery)
      .orderBy(desc(discounts.createdAt))
      .limit(limit);

    // Get discount targets to compute "applies to"
    const allTargets = await db.select().from(discountTargets);

    // Get product counts for each discount
    const productCounts = new Map<string, number>();
    for (const target of allTargets) {
      if (target.targetType === "product_ids" && target.productIds) {
        const ids = target.productIds as string[];
        productCounts.set(target.discountId, ids.length);
      } else {
        productCounts.set(target.discountId, -1); // -1 means "all products"
      }
    }

    // Get customer counts for specific eligibility discounts
    const customerCounts = new Map<string, number>();
    const specificEligibilityDiscounts = allDiscounts.filter(
      (d) => d.customerEligibilityType === "specific"
    );
    if (specificEligibilityDiscounts.length > 0) {
      const discountIds = specificEligibilityDiscounts.map((d) => d.id);
      const customerDiscounts = await db
        .select({
          discountId: discountCustomers.discountId,
          count: sql<number>`count(*)::int`,
        })
        .from(discountCustomers)
        .where(inArray(discountCustomers.discountId, discountIds))
        .groupBy(discountCustomers.discountId);

      for (const cd of customerDiscounts) {
        customerCounts.set(cd.discountId, cd.count);
      }
    }

    // Compute status and other derived fields
    const nowTime2 = new Date();
    const discountsWithDetails: DiscountWithDetails[] = allDiscounts.map(
      (discount) => {
        // Compute status
        let status: "active" | "scheduled" | "expired" | "disabled";
        if (!discount.isActive) {
          status = "disabled";
        } else if (discount.startsAt && discount.startsAt > nowTime2) {
          status = "scheduled";
        } else if (discount.endsAt && discount.endsAt < nowTime2) {
          status = "expired";
        } else {
          status = "active";
        }

        // Compute "applies to"
        const productCount = productCounts.get(discount.id);
        const appliesTo =
          productCount === -1
            ? "All products"
            : productCount
              ? `${productCount} products`
              : "No products";

        // Compute usage
        const usageLimit = discount.usageLimit;
        const usage = usageLimit
          ? `${discount.usageCount} / ${usageLimit}`
          : `${discount.usageCount} / ∞`;

        // Compute active dates
        let activeDates = "—";
        if (discount.startsAt || discount.endsAt) {
          const start = discount.startsAt
            ? new Date(discount.startsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null;
          const end = discount.endsAt
            ? new Date(discount.endsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null;
          if (start && end) {
            activeDates = `${start} – ${end}`;
          } else if (start) {
            activeDates = `From ${start}`;
          } else if (end) {
            activeDates = `Until ${end}`;
          }
        }

        return {
          id: discount.id,
          name: discount.name,
          code: discount.code,
          type: discount.type,
          valueType: discount.valueType,
          value: discount.value,
          currency: discount.currency,
          appliesOncePerOrder: discount.appliesOncePerOrder ?? false,
          usageLimit: discount.usageLimit,
          usageCount: discount.usageCount,
          minPurchaseAmount: discount.minPurchaseAmount,
          minPurchaseQuantity: discount.minPurchaseQuantity,
          customerEligibilityType: discount.customerEligibilityType,
          startsAt: discount.startsAt,
          endsAt: discount.endsAt,
          isActive: discount.isActive,
          createdAt: discount.createdAt,
          updatedAt: discount.updatedAt,
          status,
          appliesTo,
          usage,
          activeDates,
          productCount: productCount === -1 ? undefined : productCount,
          customerCount: customerCounts.get(discount.id),
        };
      }
    );

    return {
      success: true,
      data: {
        discounts: discountsWithDetails.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type as "amount_off_products",
          valueType: d.valueType as "fixed" | "percentage",
          value: parseFloat(d.value),
          currency: d.currency,
          isActive: d.isActive,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          usageLimit: d.usageLimit,
          usageCount: d.usageCount,
          status: d.status,
          appliesTo: d.appliesTo,
          usage: d.usage,
          activeDates: d.activeDates,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching discounts:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch discounts",
    };
  }
}

/**
 * Get all discounts (backward compatibility - uses listDiscounts internally)
 */
export async function getDiscounts(): Promise<{
  success: boolean;
  discounts?: DiscountWithDetails[];
  error?: string;
}> {
  // Use listDiscounts which already handles role-based filtering
  const result = await listDiscounts({});
  if (!result.success) {
    return result;
  }

  // Get the filtered discount IDs from listDiscounts result
  const filteredDiscountIds = result.data?.discounts?.map((d) => d.id) || [];

  if (filteredDiscountIds.length === 0) {
    return {
      success: true,
      discounts: [],
    };
  }

  // Convert back to old format for backward compatibility
  const allDiscounts = await db
    .select()
    .from(discounts)
    .where(inArray(discounts.id, filteredDiscountIds))
    .orderBy(desc(discounts.createdAt));

  // Only get targets for the filtered discounts
  const allTargets = await db
    .select()
    .from(discountTargets)
    .where(inArray(discountTargets.discountId, filteredDiscountIds));

  const productCounts = new Map<string, number>();
  for (const target of allTargets) {
    if (target.targetType === "product_ids" && target.productIds) {
      const ids = target.productIds as string[];
      productCounts.set(target.discountId, ids.length);
    } else {
      productCounts.set(target.discountId, -1);
    }
  }

  const customerCounts = new Map<string, number>();
  const specificEligibilityDiscounts = allDiscounts.filter(
    (d) => d.customerEligibilityType === "specific"
  );
  if (specificEligibilityDiscounts.length > 0) {
    const discountIds = specificEligibilityDiscounts.map((d) => d.id);
    const customerDiscounts = await db
      .select({
        discountId: discountCustomers.discountId,
        count: sql<number>`count(*)::int`,
      })
      .from(discountCustomers)
      .where(inArray(discountCustomers.discountId, discountIds))
      .groupBy(discountCustomers.discountId);

    for (const cd of customerDiscounts) {
      customerCounts.set(cd.discountId, cd.count);
    }
  }

  const now = new Date();
  const discountsWithDetails: DiscountWithDetails[] = allDiscounts.map(
    (discount) => {
      let status: "active" | "scheduled" | "expired" | "disabled";
      if (!discount.isActive) {
        status = "disabled";
      } else if (discount.startsAt && discount.startsAt > now) {
        status = "scheduled";
      } else if (discount.endsAt && discount.endsAt < now) {
        status = "expired";
      } else {
        status = "active";
      }

      const productCount = productCounts.get(discount.id);
      const appliesTo =
        productCount === -1
          ? "All products"
          : productCount
            ? `${productCount} products`
            : "No products";

      const usageLimit = discount.usageLimit;
      const usage = usageLimit
        ? `${discount.usageCount} / ${usageLimit}`
        : `${discount.usageCount} / ∞`;

      let activeDates = "—";
      if (discount.startsAt || discount.endsAt) {
        const start = discount.startsAt
          ? new Date(discount.startsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;
        const end = discount.endsAt
          ? new Date(discount.endsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;
        if (start && end) {
          activeDates = `${start} – ${end}`;
        } else if (start) {
          activeDates = `From ${start}`;
        } else if (end) {
          activeDates = `Until ${end}`;
        }
      }

      return {
        id: discount.id,
        name: discount.name,
        code: discount.code,
        type: discount.type,
        valueType: discount.valueType,
        value: discount.value,
        currency: discount.currency,
        appliesOncePerOrder: discount.appliesOncePerOrder ?? false,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
        minPurchaseAmount: discount.minPurchaseAmount,
        minPurchaseQuantity: discount.minPurchaseQuantity,
        customerEligibilityType: discount.customerEligibilityType,
        startsAt: discount.startsAt,
        endsAt: discount.endsAt,
        isActive: discount.isActive,
        createdAt: discount.createdAt,
        updatedAt: discount.updatedAt,
        status,
        appliesTo,
        usage,
        activeDates,
        productCount: productCount === -1 ? undefined : productCount,
        customerCount: customerCounts.get(discount.id),
      };
    }
  );

  return { success: true, discounts: discountsWithDetails };
}

/**
 * Get a single discount by ID with full details
 */
export async function getDiscountById(discountId: string): Promise<
  ActionResult<{
    id: string;
    type: "amount_off_products";
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    targets:
      | { type: "all_products" }
      | { type: "listing_ids"; listingIds: string[] };
    minimumRequirement:
      | { type: "none" }
      | { type: "amount"; amount: number }
      | { type: "quantity"; quantity: number };
    eligibility: { type: "all" } | { type: "specific"; customerIds: string[] };
    usageLimit: number | null;
    usageCount: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    ownerType: "admin" | "seller";
    ownerId: string | null;
  }>
> {
  try {
    // TODO: get session (shopId, role, sellerId)
    await checkDiscountPermission(discountId);

    // TODO: load discount
    const discountData = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (discountData.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    // TODO: enforce access (seller owns discount or admin)
    const discount = discountData[0];

    // TODO: load targets + eligible customers
    const targets = await db
      .select()
      .from(discountTargets)
      .where(eq(discountTargets.discountId, discountId));

    const listingIds: string[] = [];
    let targetType: "all_products" | "listing_ids" = "all_products";
    if (targets.length > 0) {
      const target = targets[0];
      // Convert database "product_ids" to schema "listing_ids"
      if (target.targetType === "product_ids") {
        targetType = "listing_ids";
        if (target.productIds) {
          listingIds.push(...(target.productIds as string[]));
        }
      } else {
        targetType = "all_products";
      }
    }

    // Get customer IDs if specific eligibility
    const customerIds: string[] = [];
    if (discount.customerEligibilityType === "specific") {
      const customerDiscounts = await db
        .select({ customerId: discountCustomers.customerId })
        .from(discountCustomers)
        .where(eq(discountCustomers.discountId, discountId));

      customerIds.push(...customerDiscounts.map((cd) => cd.customerId));
    }

    // TODO: normalize shape for UI

    // Normalize shape for UI
    const targetsNormalized:
      | { type: "all_products" }
      | { type: "listing_ids"; listingIds: string[] } =
      targetType === "all_products"
        ? { type: "all_products" }
        : { type: "listing_ids", listingIds: listingIds };

    const minimumRequirement:
      | { type: "none" }
      | { type: "amount"; amount: number }
      | { type: "quantity"; quantity: number } = discount.minPurchaseAmount
      ? { type: "amount", amount: parseFloat(discount.minPurchaseAmount) }
      : discount.minPurchaseQuantity
        ? { type: "quantity", quantity: discount.minPurchaseQuantity }
        : { type: "none" };

    const eligibility:
      | { type: "all" }
      | { type: "specific"; customerIds: string[] } =
      discount.customerEligibilityType === "specific"
        ? { type: "specific", customerIds }
        : { type: "all" };

    return {
      success: true,
      data: {
        id: discount.id,
        type: discount.type as "amount_off_products",
        name: discount.name,
        code: discount.code,
        valueType: discount.valueType as "fixed" | "percentage",
        value: parseFloat(discount.value),
        currency: discount.currency,
        targets: targetsNormalized,
        minimumRequirement,
        eligibility,
        usageLimit: discount.usageLimit,
        usageCount: discount.usageCount,
        startsAt: discount.startsAt,
        endsAt: discount.endsAt,
        isActive: discount.isActive,
        ownerType: (discount.ownerType as "admin" | "seller") || "admin",
        ownerId: discount.ownerId || null,
      },
    };
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
 * Create Amount-Off-Products Discount
 */
export async function createAmountOffProductsDiscount(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateAmountOffProductsDiscountSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten(),
    };
  }

  const input: CreateAmountOffProductsDiscountInput = parsed.data;

  try {
    // TODO: get session (shopId, role, sellerId)
    const user = await getCurrentUser();
    const { isAdmin, storeId } = await checkDiscountPermission();

    // Set ownership (per inst.md)
    const ownerType = isAdmin ? "admin" : "seller";
    const ownerId = isAdmin ? null : storeId;

    // TODO: authorize seller/admin
    // TODO: check discount code uniqueness (per shop)
    if (input.code) {
      const existing = await db
        .select()
        .from(discounts)
        .where(eq(discounts.code, input.code))
        .limit(1);

      if (existing.length > 0) {
        return {
          success: false,
          error: "Discount code already exists",
        };
      }
    }

    // TODO: verify listingIds belong to shop/seller
    if (input.targets.type === "listing_ids") {
      // Verify listings exist and belong to seller (if seller)
      if (!isAdmin) {
        const storeData = await db
          .select({ storeId: storeMembers.storeId })
          .from(storeMembers)
          .where(eq(storeMembers.userId, user.id))
          .limit(1);

        if (storeData.length > 0) {
          const validListings = await db
            .select({ id: listing.id })
            .from(listing)
            .where(
              and(
                inArray(listing.id, input.targets.listingIds),
                eq(listing.storeId, storeData[0].storeId)
              )
            );

          if (validListings.length !== input.targets.listingIds.length) {
            return {
              success: false,
              error: "Some products do not belong to your store",
            };
          }
        }
      }
    }

    // TODO: verify customerIds belong to shop (if eligibility = specific)
    if (input.eligibility.type === "specific") {
      // For now, allow all customers - can add shop restriction later
    }

    // TODO: insert into discounts table
    // TODO: insert into discount_targets table
    // TODO: insert into discount_customers table (if specific eligibility)
    const result = await db.transaction(async (tx) => {
      // Extract minimum requirement
      const minPurchaseAmount =
        input.minimumRequirement.type === "amount"
          ? input.minimumRequirement.amount.toString()
          : null;
      const minPurchaseQuantity =
        input.minimumRequirement.type === "quantity"
          ? input.minimumRequirement.quantity
          : null;

      // Insert discount
      const [newDiscount] = await tx
        .insert(discounts)
        .values({
          type: input.type,
          name: input.name,
          code: input.code || null,
          valueType: input.valueType,
          value: input.value.toString(),
          currency: input.currency || null,
          appliesOncePerOrder: false, // Not in schema yet
          usageLimit: input.usageLimit || null,
          usageCount: 0,
          minPurchaseAmount,
          minPurchaseQuantity,
          customerEligibilityType:
            input.eligibility.type === "specific" ? "specific" : "all",
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive !== false,
          ownerType: ownerType,
          ownerId: ownerId,
        })
        .returning();

      // Insert discount target
      // Note: database uses "product_ids" but schema uses "listing_ids"
      await tx.insert(discountTargets).values({
        discountId: newDiscount.id,
        targetType:
          input.targets.type === "all_products"
            ? "all_products"
            : "product_ids",
        productIds:
          input.targets.type === "listing_ids"
            ? input.targets.listingIds
            : null,
      });

      // Insert customer eligibility entries if specific
      if (input.eligibility.type === "specific") {
        await tx.insert(discountCustomers).values(
          input.eligibility.customerIds.map((customerId) => ({
            discountId: newDiscount.id,
            customerId,
          }))
        );
      }

      return newDiscount.id;
    });

    revalidatePath("/dashboard/discounts");

    return { success: true, data: { id: result } };
  } catch (error) {
    console.error("Error creating discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create discount",
    };
  }
}

/**
 * Create discount (backward compatibility wrapper)
 */
export async function createDiscount(data: {
  name: string;
  code?: string | null;
  type: "amount_off_products";
  valueType: "fixed" | "percentage";
  value: number;
  currency?: string | null;
  appliesOncePerOrder?: boolean;
  usageLimit?: number | null;
  minPurchaseAmount?: number | null;
  minPurchaseQuantity?: number | null;
  customerEligibilityType: "all" | "specific";
  customerIds?: string[];
  targetType: "all_products" | "product_ids";
  productIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}): Promise<{ success: boolean; discountId?: string; error?: string }> {
  // Convert old format to new format
  const input: CreateAmountOffProductsDiscountInput = {
    type: "amount_off_products",
    name: data.name,
    code: data.code || undefined,
    valueType: data.valueType,
    value: data.value,
    currency: data.currency ?? undefined,
    targets:
      data.targetType === "all_products"
        ? { type: "all_products" }
        : { type: "listing_ids", listingIds: data.productIds || [] },
    minimumRequirement: data.minPurchaseAmount
      ? { type: "amount", amount: data.minPurchaseAmount }
      : data.minPurchaseQuantity
        ? { type: "quantity", quantity: data.minPurchaseQuantity }
        : { type: "none" },
    eligibility:
      data.customerEligibilityType === "specific"
        ? { type: "specific", customerIds: data.customerIds || [] }
        : { type: "all" },
    usageLimit: data.usageLimit || undefined,
    startsAt: data.startsAt?.toISOString(),
    endsAt: data.endsAt?.toISOString(),
    isActive: data.isActive !== false,
  };

  const result = await createAmountOffProductsDiscount(input);
  if (result.success) {
    return { success: true, discountId: result.data.id };
  }
  return result;
}

/**
 * Update Discount
 */
export async function updateDiscount(
  discountId: string,
  rawInput: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = UpdateDiscountSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: z.flattenError(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    // TODO: get session (shopId, role, sellerId)
    await checkDiscountPermission(discountId);

    // TODO: load discount + usageCount
    const existing = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    // TODO: enforce edit rules if discount already used
    const usedDiscounts = await db
      .select()
      .from(orderDiscounts)
      .where(eq(orderDiscounts.discountId, discountId))
      .limit(1);

    const hasBeenUsed = usedDiscounts.length > 0;

    // TODO: enforce ownership / admin access

    // Validate code uniqueness (excluding current discount)
    if (input.code) {
      const existingCode = await db
        .select()
        .from(discounts)
        .where(
          and(eq(discounts.code, input.code), ne(discounts.id, discountId))
        )
        .limit(1);

      if (existingCode.length > 0) {
        return {
          success: false,
          error: "Discount code already exists",
        };
      }
    }

    // TODO: update discounts table
    // TODO: update discount_targets
    // TODO: update discount_customers
    await db.transaction(async (tx) => {
      // Build update data from input (only update provided fields)
      const updateData: Partial<typeof discounts.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.code !== undefined) updateData.code = input.code ?? null;
      if (input.usageLimit !== undefined)
        updateData.usageLimit = input.usageLimit || null;
      if (input.startsAt !== undefined)
        updateData.startsAt = input.startsAt ? new Date(input.startsAt) : null;
      if (input.endsAt !== undefined)
        updateData.endsAt = input.endsAt ? new Date(input.endsAt) : null;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      // Handle minimum requirement
      if (input.minimumRequirement !== undefined) {
        if (input.minimumRequirement.type === "amount") {
          updateData.minPurchaseAmount =
            input.minimumRequirement.amount.toString();
          updateData.minPurchaseQuantity = null;
        } else if (input.minimumRequirement.type === "quantity") {
          updateData.minPurchaseQuantity = input.minimumRequirement.quantity;
          updateData.minPurchaseAmount = null;
        } else {
          updateData.minPurchaseAmount = null;
          updateData.minPurchaseQuantity = null;
        }
      }

      // Handle eligibility
      if (input.eligibility !== undefined) {
        updateData.customerEligibilityType =
          input.eligibility.type === "specific" ? "specific" : "all";
      }

      // If discount has been used, don't allow value/applies to changes
      if (!hasBeenUsed) {
        if (input.valueType !== undefined)
          updateData.valueType = input.valueType;
        if (input.value !== undefined)
          updateData.value = input.value.toString();
        if (input.currency !== undefined) updateData.currency = input.currency;
      }

      await tx
        .update(discounts)
        .set(updateData)
        .where(eq(discounts.id, discountId));

      // Update discount target (if provided and not used)
      // Note: database uses "product_ids" but schema uses "listing_ids"
      if (input.targets !== undefined && !hasBeenUsed) {
        await tx
          .delete(discountTargets)
          .where(eq(discountTargets.discountId, discountId));
        await tx.insert(discountTargets).values({
          discountId,
          targetType:
            input.targets.type === "all_products"
              ? "all_products"
              : "product_ids",
          productIds:
            input.targets.type === "listing_ids"
              ? input.targets.listingIds
              : null,
        });
      }

      // Update customer eligibility (if provided)
      if (input.eligibility !== undefined) {
        await tx
          .delete(discountCustomers)
          .where(eq(discountCustomers.discountId, discountId));

        if (input.eligibility.type === "specific") {
          await tx.insert(discountCustomers).values(
            input.eligibility.customerIds.map((customerId) => ({
              discountId,
              customerId,
            }))
          );
        }
      }
    });

    revalidatePath("/dashboard/discounts");
    revalidatePath(`/dashboard/discounts/${discountId}`);

    return { success: true, data: { ok: true } };
  } catch (error) {
    console.error("Error updating discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update discount",
    };
  }
}

/**
 * Update discount (backward compatibility wrapper)
 */
export async function updateDiscountOld(data: {
  id: string;
  name: string;
  code?: string | null;
  type: "amount_off_products";
  valueType: "fixed" | "percentage";
  value: number;
  currency?: string | null;
  appliesOncePerOrder?: boolean;
  usageLimit?: number | null;
  minPurchaseAmount?: number | null;
  minPurchaseQuantity?: number | null;
  customerEligibilityType: "all" | "specific";
  customerIds?: string[];
  targetType: "all_products" | "product_ids";
  productIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  // Convert old format to new format
  const input: UpdateDiscountInput = {
    type: "amount_off_products",
    name: data.name,
    code: data.code || undefined,
    valueType: data.valueType,
    value: data.value,
    currency: data.currency ?? undefined,
    targets:
      data.targetType === "all_products"
        ? { type: "all_products" }
        : { type: "listing_ids", listingIds: data.productIds || [] },
    minimumRequirement: data.minPurchaseAmount
      ? { type: "amount", amount: data.minPurchaseAmount }
      : data.minPurchaseQuantity
        ? { type: "quantity", quantity: data.minPurchaseQuantity }
        : { type: "none" },
    eligibility:
      data.customerEligibilityType === "specific"
        ? { type: "specific", customerIds: data.customerIds || [] }
        : { type: "all" },
    usageLimit: data.usageLimit || undefined,
    startsAt: data.startsAt?.toISOString(),
    endsAt: data.endsAt?.toISOString(),
    isActive: data.isActive !== false,
  };

  const result = await updateDiscount(data.id, input);
  if (result.success) {
    return { success: true };
  }
  return result;
}

/**
 * Delete Discount (Admin / Unused Only)
 */
export async function deleteDiscount(
  discountId: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    // TODO: get session
    const { isAdmin } = await checkDiscountPermission(discountId);

    // TODO: authorize admin OR seller owner
    // Only admins can delete
    if (!isAdmin) {
      return { success: false, error: "Only admins can delete discounts" };
    }

    // TODO: check usageCount === 0
    const usedDiscounts = await db
      .select()
      .from(orderDiscounts)
      .where(eq(orderDiscounts.discountId, discountId))
      .limit(1);

    if (usedDiscounts.length > 0) {
      return {
        success: false,
        error: "Cannot delete discount that has been used in orders",
      };
    }

    // TODO: soft-delete or hard-delete
    // Delete discount (cascade will handle targets and customers)
    await db.delete(discounts).where(eq(discounts.id, discountId));

    revalidatePath("/dashboard/discounts");

    return { success: true, data: { ok: true } };
  } catch (error) {
    console.error("Error deleting discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete discount",
    };
  }
}

/**
 * Toggle Active (Table Action)
 */
export async function toggleDiscountActive(
  discountId: string,
  rawInput: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = ToggleDiscountSchema.safeParse(rawInput);

  if (!parsed.success) {
    return { success: false, error: "Invalid payload" };
  }

  const { isActive } = parsed.data;

  try {
    // TODO: get session
    await checkDiscountPermission(discountId);

    // TODO: authorize
    const discountData = await db
      .select({ isActive: discounts.isActive })
      .from(discounts)
      .where(eq(discounts.id, discountId))
      .limit(1);

    if (discountData.length === 0) {
      return { success: false, error: "Discount not found" };
    }

    // TODO: update discounts.isActive
    await db
      .update(discounts)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(discounts.id, discountId));

    revalidatePath("/dashboard/discounts");
    revalidatePath(`/dashboard/discounts/${discountId}`);

    return { success: true, data: { ok: true } };
  } catch (error) {
    console.error("Error toggling discount status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle discount status",
    };
  }
}

/**
 * Toggle discount status (backward compatibility wrapper)
 */
export async function toggleDiscountStatus(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const discountData = await db
    .select({ isActive: discounts.isActive })
    .from(discounts)
    .where(eq(discounts.id, id))
    .limit(1);

  if (discountData.length === 0) {
    return { success: false, error: "Discount not found" };
  }

  const result = await toggleDiscountActive(id, {
    isActive: !discountData[0].isActive,
  });

  if (result.success) {
    return { success: true };
  }
  return result;
}

/**
 * Duplicate Discount
 */
export async function duplicateDiscount(
  discountId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    // TODO: get session
    await checkDiscountPermission(discountId);

    // TODO: load discount + targets + customers
    const discountData = await getDiscountById(discountId);
    if (!discountData.success) {
      return { success: false, error: "Discount not found" };
    }

    const original = discountData.data;

    // TODO: authorize
    // TODO: clone discount (reset usageCount, disable by default)
    // TODO: clone targets + eligible customers
    const newDiscountData: CreateAmountOffProductsDiscountInput = {
      type: "amount_off_products",
      name: `${original.name} (Copy)`,
      code: undefined, // Don't copy code
      valueType: original.valueType,
      value: original.value,
      currency: original.currency || undefined,
      targets: original.targets,
      minimumRequirement: original.minimumRequirement,
      eligibility: original.eligibility,
      usageLimit: original.usageLimit || undefined,
      startsAt: original.startsAt?.toISOString(),
      endsAt: original.endsAt?.toISOString(),
      isActive: false, // Start as inactive
    };

    const result = await createAmountOffProductsDiscount(newDiscountData);

    return result;
  } catch (error) {
    console.error("Error duplicating discount:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to duplicate discount",
    };
  }
}

/**
 * Product Picker (Server Action Friendly)
 */
export async function listListingsForPicker(
  query?: string,
  storeId?: string | null
): Promise<
  ActionResult<{
    listings: Array<{
      id: string;
      name: string;
      price: number;
      currency: string;
      image: string | null;
      sku: string | null;
    }>;
  }>
> {
  try {
    // TODO: get session
    const user = await getCurrentUser();
    const { isAdmin } = await checkDiscountPermission();

    // TODO: restrict to seller/shop
    // TODO: search by name/SKU
    // TODO: paginate
    let listings;
    if (isAdmin) {
      // Admins see all active products, or filter by storeId if provided (when editing seller's discount)
      const conditions = [eq(listing.status, "active")];

      // If storeId is provided, filter by that store (for admin editing seller's discount)
      if (storeId) {
        conditions.push(eq(listing.storeId, storeId));
      }

      if (query) {
        conditions.push(
          or(
            sql`${listing.name} ILIKE ${`%${query}%`}`,
            sql`${listing.id}::text ILIKE ${`%${query}%`}`
          )!
        );
      }

      listings = await db
        .select({
          id: listing.id,
          name: listing.name,
          price: listing.price,
          currency: listing.currency,
          imageUrl: listing.imageUrl,
          sku: sql<string | null>`NULL`, // SKU is on variants, not listing
        })
        .from(listing)
        .where(and(...conditions))
        .orderBy(listing.name);
    } else {
      // Sellers see only their products
      const storeData = await db
        .select({ storeId: storeMembers.storeId })
        .from(storeMembers)
        .where(eq(storeMembers.userId, user.id))
        .limit(1);

      if (storeData.length === 0) {
        return { success: true, data: { listings: [] } };
      }

      const conditions = [
        eq(listing.storeId, storeData[0].storeId),
        eq(listing.status, "active"),
      ];
      if (query) {
        conditions.push(
          or(
            sql`${listing.name} ILIKE ${`%${query}%`}`,
            sql`${listing.id}::text ILIKE ${`%${query}%`}`
          )!
        );
      }

      listings = await db
        .select({
          id: listing.id,
          name: listing.name,
          price: listing.price,
          currency: listing.currency,
          imageUrl: listing.imageUrl,
          sku: sql<string | null>`NULL`,
        })
        .from(listing)
        .where(and(...conditions))
        .orderBy(listing.name);
    }

    return {
      success: true,
      data: {
        listings: listings.map((l) => ({
          id: l.id,
          name: l.name,
          price: parseFloat(l.price),
          currency: l.currency,
          image: l.imageUrl,
          sku: l.sku,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching listings for picker:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch listings",
    };
  }
}

/**
 * Get products for picker (backward compatibility wrapper)
 */
export async function getProductsForPicker(storeId?: string | null): Promise<{
  success: boolean;
  products?: Array<{
    id: string;
    name: string;
    price: string;
    currency: string;
  }>;
  error?: string;
}> {
  const result = await listListingsForPicker(undefined, storeId);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    products: result.data.listings.map((l) => ({
      id: l.id,
      name: l.name,
      price: l.price.toString(),
      currency: l.currency,
    })),
  };
}

/**
 * Customer Picker
 */
export async function listCustomersForPicker(
  query?: string,
  storeId?: string | null
): Promise<
  ActionResult<{
    customers: Array<{
      id: string;
      email: string;
      name: string | null;
    }>;
  }>
> {
  try {
    // TODO: get session
    await getCurrentUser();
    const { isAdmin } = await checkDiscountPermission();

    // Build conditions array
    const conditions: ReturnType<typeof and>[] = [];

    // If storeId is provided (admin editing seller's discount), filter customers
    // who have orders with items from that store's listings
    if (storeId && isAdmin) {
      // Customers who either:
      // 1. Have storeId = storeId (explicitly assigned to this store)
      // 2. Have orders with items from this store's listings
      conditions.push(
        or(
          eq(customers.storeId, storeId),
          // Customer has orders with items from this store's listings
          sql`EXISTS (
            SELECT 1 
            FROM ${orders} o
            INNER JOIN ${orderItems} oi ON o.id = oi.order_id
            INNER JOIN ${listing} l ON oi.listing_id = l.id
            WHERE o.customer_id = ${customers.id}
            AND l.store_id = ${storeId}
          )`
        )
      );
    }

    // Search condition
    if (query) {
      conditions.push(
        or(
          sql`${customers.email} ILIKE ${`%${query}%`}`,
          sql`${customers.firstName} ILIKE ${`%${query}%`}`,
          sql`${customers.lastName} ILIKE ${`%${query}%`}`
        )
      );
    }

    // Build and execute query
    const baseQuery = db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customers);

    const queryWithConditions =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const customerData = await (
      queryWithConditions as typeof baseQuery
    ).orderBy(customers.email);

    return {
      success: true,
      data: {
        customers: customerData.map((c) => ({
          id: c.id,
          email: c.email,
          name:
            c.firstName || c.lastName
              ? `${c.firstName || ""} ${c.lastName || ""}`.trim()
              : null,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching customers for picker:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch customers",
    };
  }
}

/**
 * Get customers for picker (backward compatibility wrapper)
 */
export async function getCustomersForPicker(storeId?: string | null): Promise<{
  success: boolean;
  customers?: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  error?: string;
}> {
  const result = await listCustomersForPicker(undefined, storeId);
  if (!result.success) {
    return result;
  }
  // Convert back to old format
  const customerData = await db
    .select({
      id: customers.id,
      email: customers.email,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(
      inArray(
        customers.id,
        result.data.customers.map((c) => c.id)
      )
    );

  return {
    success: true,
    customers: customerData,
  };
}
