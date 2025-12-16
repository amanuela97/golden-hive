"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  draftOrders,
  customers,
  store,
  storeMembers,
  inventoryItems,
  inventoryLevels,
  inventoryAdjustments,
  listingVariants,
  listing,
  userRoles,
  roles,
  user,
  shippingBillingInfo,
  orderEvents,
} from "@/db/schema";
import {
  eq,
  and,
  sql,
  like,
  or,
  desc,
  asc,
  inArray,
  isNull,
} from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type OrderRow = {
  id: string;
  orderNumber: number;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  totalAmount: string;
  currency: string;
  paymentStatus:
    | "pending"
    | "paid"
    | "partially_refunded"
    | "refunded"
    | "failed"
    | "void";
  fulfillmentStatus:
    | "unfulfilled"
    | "partial"
    | "fulfilled"
    | "canceled"
    | "on_hold";
  status: "open" | "draft" | "archived" | "canceled";
  placedAt: Date | null;
  createdAt: Date;
  itemsCount: number;
  shippingMethod: string | null;
  archivedAt: Date | null;
  // Warning flags (derived)
  hasAddressWarning?: boolean;
  hasRiskWarning?: boolean;
};

export type OrderFilters = {
  search?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  status?: string; // "open" | "draft" | "archived" | "canceled"
  archived?: boolean; // true for archived orders (archivedAt IS NOT NULL)
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type LineItemInput = {
  listingId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: string;
  title: string;
  sku?: string | null;
};

export type CreateOrderInput = {
  customerId?: string | null;
  customerEmail: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  lineItems: LineItemInput[];
  currency: string;
  subtotalAmount: string;
  discountAmount?: string;
  shippingAmount?: string;
  taxAmount?: string;
  totalAmount: string;
  paymentStatus?:
    | "pending"
    | "paid"
    | "partially_refunded"
    | "refunded"
    | "failed"
    | "void";
  fulfillmentStatus?:
    | "unfulfilled"
    | "partial"
    | "fulfilled"
    | "canceled"
    | "on_hold";
  status?: "open" | "draft" | "archived" | "canceled";
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  billingName?: string | null;
  billingPhone?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingCity?: string | null;
  billingRegion?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  notes?: string | null;
  tags?: string | null;
};

/**
 * Get or create customer for current user
 * Returns customer data for auto-filling the form
 */
export async function getOrCreateCustomerForUser(): Promise<{
  success: boolean;
  data?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    shippingFirstName: string | null;
    shippingLastName: string | null;
    shippingAddress: string | null;
    shippingAddress2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    shippingCountry: string | null;
    billingFirstName: string | null;
    billingLastName: string | null;
    billingAddress: string | null;
    billingAddress2: string | null;
    billingCity: string | null;
    billingState: string | null;
    billingZip: string | null;
    billingCountry: string | null;
    billingPhone: string | null;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Check if customer exists for this user
    const existingCustomer = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (existingCustomer.length > 0) {
      const customer = existingCustomer[0];

      // Get current user data to use as fallback/update source
      const userData = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const userRecord = userData[0] || null;

      // Get shipping/billing info if available
      const shippingBilling = await db
        .select()
        .from(shippingBillingInfo)
        .where(eq(shippingBillingInfo.userId, userId))
        .limit(1);

      const sbInfo = shippingBilling[0] || null;

      // Use user table data as fallback for customer fields that are null
      // This ensures we always have the latest profile data
      const phone = customer.phone || userRecord?.phone || null;
      const firstName =
        customer.firstName || userRecord?.name?.split(" ")[0] || null;
      const lastName =
        customer.lastName ||
        userRecord?.name?.split(" ").slice(1).join(" ") ||
        null;
      const addressLine1 = customer.addressLine1 || userRecord?.address || null;
      const city = customer.city || userRecord?.city || null;
      const country = customer.country || userRecord?.country || null;

      // Update customer record if user profile has newer data (optional - for future sync)
      // This keeps the customer record in sync with user profile changes
      const updateData: {
        phone?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        addressLine1?: string | null;
        city?: string | null;
        country?: string | null;
      } = {};

      if (userRecord?.phone && !customer.phone) {
        updateData.phone = userRecord.phone;
      }
      if (userRecord?.name && !customer.firstName && !customer.lastName) {
        const nameParts = userRecord.name.split(" ");
        updateData.firstName = nameParts[0] || null;
        updateData.lastName = nameParts.slice(1).join(" ") || null;
      }
      if (userRecord?.address && !customer.addressLine1) {
        updateData.addressLine1 = userRecord.address;
      }
      if (userRecord?.city && !customer.city) {
        updateData.city = userRecord.city;
      }
      if (userRecord?.country && !customer.country) {
        updateData.country = userRecord.country;
      }

      // Update customer if there are changes
      if (Object.keys(updateData).length > 0) {
        await db
          .update(customers)
          .set(updateData)
          .where(eq(customers.id, customer.id));
      }

      return {
        success: true,
        data: {
          id: customer.id,
          email: customer.email,
          firstName,
          lastName,
          phone,
          addressLine1,
          addressLine2: customer.addressLine2,
          city,
          region: customer.region,
          postalCode: customer.postalCode,
          country,
          shippingFirstName: sbInfo?.shippingFirstName || null,
          shippingLastName: sbInfo?.shippingLastName || null,
          shippingAddress: sbInfo?.shippingAddress || null,
          shippingAddress2: sbInfo?.shippingAddress2 || null,
          shippingCity: sbInfo?.shippingCity || null,
          shippingState: sbInfo?.shippingState || null,
          shippingZip: sbInfo?.shippingZip || null,
          shippingCountry: sbInfo?.shippingCountry || null,
          billingFirstName: sbInfo?.billingFirstName || null,
          billingLastName: sbInfo?.billingLastName || null,
          billingAddress: sbInfo?.billingAddress || null,
          billingAddress2: sbInfo?.billingAddress2 || null,
          billingCity: sbInfo?.billingCity || null,
          billingState: sbInfo?.billingState || null,
          billingZip: sbInfo?.billingZip || null,
          billingCountry: sbInfo?.billingCountry || null,
          billingPhone: sbInfo?.billingPhone || null,
        },
      };
    }

    // Customer doesn't exist - create from user + shipping_billing_info
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userData.length === 0) {
      return { success: false, error: "User not found" };
    }

    const userRecord = userData[0];
    const shippingBilling = await db
      .select()
      .from(shippingBillingInfo)
      .where(eq(shippingBillingInfo.userId, userId))
      .limit(1);

    const sbInfo = shippingBilling[0] || null;

    // Get store ID for the customer
    const { storeId } = await getStoreIdForUser();

    // Extract first/last name from user.name if available
    const nameParts = userRecord.name?.split(" ") || [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(" ") || null;

    // Create new customer
    const newCustomer = await db
      .insert(customers)
      .values({
        storeId: storeId || null,
        userId: userId,
        email: userRecord.email || "",
        firstName: firstName,
        lastName: lastName,
        phone: userRecord.phone || null,
        addressLine1: sbInfo?.shippingAddress || userRecord.address || null,
        addressLine2: null,
        city: sbInfo?.shippingCity || userRecord.city || null,
        region: sbInfo?.shippingState || null,
        postalCode: sbInfo?.shippingZip || null,
        country: sbInfo?.shippingCountry || userRecord.country || null,
      })
      .returning();

    return {
      success: true,
      data: {
        id: newCustomer[0].id,
        email: newCustomer[0].email,
        firstName: newCustomer[0].firstName,
        lastName: newCustomer[0].lastName,
        phone: newCustomer[0].phone,
        addressLine1: newCustomer[0].addressLine1,
        addressLine2: newCustomer[0].addressLine2,
        city: newCustomer[0].city,
        region: newCustomer[0].region,
        postalCode: newCustomer[0].postalCode,
        country: newCustomer[0].country,
        shippingFirstName: sbInfo?.shippingFirstName || null,
        shippingLastName: sbInfo?.shippingLastName || null,
        shippingAddress: sbInfo?.shippingAddress || null,
        shippingAddress2: sbInfo?.shippingAddress2 || null,
        shippingCity: sbInfo?.shippingCity || null,
        shippingState: sbInfo?.shippingState || null,
        shippingZip: sbInfo?.shippingZip || null,
        shippingCountry: sbInfo?.shippingCountry || null,
        billingFirstName: sbInfo?.billingFirstName || null,
        billingLastName: sbInfo?.billingLastName || null,
        billingAddress: sbInfo?.billingAddress || null,
        billingAddress2: sbInfo?.billingAddress2 || null,
        billingCity: sbInfo?.billingCity || null,
        billingState: sbInfo?.billingState || null,
        billingZip: sbInfo?.billingZip || null,
        billingCountry: sbInfo?.billingCountry || null,
        billingPhone: sbInfo?.billingPhone || null,
      },
    };
  } catch (error) {
    console.error("Error getting/creating customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get customer",
    };
  }
}

/**
 * Check if customer email exists
 */
export async function checkCustomerEmailExists(email: string): Promise<{
  success: boolean;
  exists?: boolean;
  customerId?: string;
  error?: string;
}> {
  try {
    const existingCustomer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    return {
      success: true,
      exists: existingCustomer.length > 0,
      customerId: existingCustomer[0]?.id,
    };
  } catch (error) {
    console.error("Error checking customer email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check email",
    };
  }
}

/**
 * Get store ID for current user (or check if admin)
 */
/**
 * Validates if a payment status transition is allowed
 */
function canTransitionPaymentStatus(from: string, to: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    pending: ["paid", "failed", "void"],
    paid: ["partially_refunded", "refunded"],
    partially_refunded: ["refunded"],
    refunded: [], // Terminal state
    failed: [], // Terminal state
    void: [], // Terminal state
  };

  return allowedTransitions[from]?.includes(to) ?? false;
}

/**
 * Validates if a fulfillment status transition is allowed
 */
function canTransitionFulfillmentStatus(from: string, to: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    unfulfilled: ["partial", "fulfilled", "canceled", "on_hold"],
    partial: ["fulfilled", "canceled", "on_hold"],
    fulfilled: ["canceled"], // Can cancel even after fulfillment
    canceled: [], // Terminal state
    on_hold: ["unfulfilled", "partial", "fulfilled", "canceled"],
  };

  return allowedTransitions[from]?.includes(to) ?? false;
}

/**
 * Validates if an order status transition is allowed
 */
function canTransitionOrderStatus(from: string, to: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    draft: ["open", "canceled"],
    open: ["archived", "canceled"],
    archived: [], // Terminal state (read-only)
    canceled: [], // Terminal state
  };

  return allowedTransitions[from]?.includes(to) ?? false;
}

/**
 * Checks if user has permission to change a specific status type
 */
async function canChangeStatus(
  statusType: "payment" | "fulfillment" | "order"
): Promise<{ allowed: boolean; error?: string }> {
  const { isAdmin } = await getStoreIdForUser();

  // Payment status: Only system (webhooks) and admin
  if (statusType === "payment") {
    // In production, check if this is a webhook call
    // For now, only allow admin
    if (!isAdmin) {
      return {
        allowed: false,
        error:
          "Only admins can change payment status. Payment status should be updated via webhooks.",
      };
    }
  }

  // Fulfillment status: Sellers and admin
  if (statusType === "fulfillment") {
    // Sellers and admins can change fulfillment
    // This is already handled by getStoreIdForUser
    return { allowed: true };
  }

  // Order status: Limited for sellers, full for admin
  if (statusType === "order") {
    // Sellers can change to canceled/archived, admin can do anything
    // We'll handle this in the update function
    return { allowed: true };
  }

  return { allowed: false, error: "Unknown status type" };
}

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

  // Get store for current user through storeMembers
  const storeResult = await db
    .select({ id: store.id })
    .from(storeMembers)
    .innerJoin(store, eq(storeMembers.storeId, store.id))
    .where(eq(storeMembers.userId, session.user.id))
    .limit(1);

  if (storeResult.length === 0) {
    return {
      storeId: null,
      isAdmin: false,
      error: "Store not found. Please set up your store information.",
    };
  }

  return { storeId: storeResult[0].id, isAdmin: false };
}

/**
 * Find default inventory location for a store
 */
async function getDefaultInventoryLocation(
  storeId: string
): Promise<string | null> {
  const location = await db
    .select({ id: inventoryLevels.locationId })
    .from(inventoryLevels)
    .innerJoin(
      inventoryItems,
      eq(inventoryLevels.inventoryItemId, inventoryItems.id)
    )
    .innerJoin(
      listingVariants,
      eq(inventoryItems.variantId, listingVariants.id)
    )
    .innerJoin(listing, eq(listingVariants.listingId, listing.id))
    .innerJoin(store, eq(listing.storeId, store.id))
    .where(eq(store.id, storeId))
    .limit(1);

  if (location.length > 0) {
    return location[0].id;
  }

  // Fallback: get first active location for store
  const fallbackLocation = await db
    .select({ id: inventoryLevels.locationId })
    .from(inventoryLevels)
    .innerJoin(
      inventoryItems,
      eq(inventoryLevels.inventoryItemId, inventoryItems.id)
    )
    .innerJoin(
      listingVariants,
      eq(inventoryItems.variantId, listingVariants.id)
    )
    .innerJoin(listing, eq(listingVariants.listingId, listing.id))
    .where(eq(listing.storeId, storeId))
    .limit(1);

  return fallbackLocation.length > 0 ? fallbackLocation[0].id : null;
}

/**
 * Check stock availability for order items
 */
async function checkStockAvailability(
  lineItems: Array<{ variantId: string | null; quantity: number }>,
  storeId: string
): Promise<{
  success: boolean;
  error?: string;
  unavailableItems?: Array<{
    variantId: string;
    available: number;
    requested: number;
  }>;
}> {
  try {
    const locationId = await getDefaultInventoryLocation(storeId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    const unavailableItems: Array<{
      variantId: string;
      available: number;
      requested: number;
    }> = [];

    for (const item of lineItems) {
      if (!item.variantId) continue;

      // Find inventory item for this variant
      const inventoryItem = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.variantId, item.variantId))
        .limit(1);

      if (inventoryItem.length === 0) {
        // No inventory item means 0 stock
        unavailableItems.push({
          variantId: item.variantId,
          available: 0,
          requested: item.quantity,
        });
        continue;
      }

      const invItemId = inventoryItem[0].id;

      // Get inventory level
      const inventoryLevel = await db
        .select({ available: inventoryLevels.available })
        .from(inventoryLevels)
        .where(
          and(
            eq(inventoryLevels.inventoryItemId, invItemId),
            eq(inventoryLevels.locationId, locationId)
          )
        )
        .limit(1);

      const available =
        inventoryLevel.length > 0 ? Number(inventoryLevel[0].available) : 0;

      if (available < item.quantity) {
        unavailableItems.push({
          variantId: item.variantId,
          available,
          requested: item.quantity,
        });
      }
    }

    if (unavailableItems.length > 0) {
      return {
        success: false,
        error: "Insufficient stock for one or more items",
        unavailableItems,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error checking stock availability:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to check stock availability",
    };
  }
}

/**
 * Adjust inventory for order items
 */
export async function adjustInventoryForOrder(
  orderItems: Array<{ variantId: string | null; quantity: number }>,
  storeId: string,
  direction: "reserve" | "release" | "fulfill" | "commit",
  reason: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const locationId = await getDefaultInventoryLocation(storeId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    // Map direction to event type
    const eventTypeMap: Record<
      typeof direction,
      "reserve" | "release" | "fulfill" | "adjustment"
    > = {
      reserve: "reserve",
      release: "release",
      fulfill: "fulfill",
      commit: "adjustment", // Payment commit is an adjustment
    };
    const eventType = eventTypeMap[direction];
    const referenceType = orderId ? "order" : "manual";

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      for (const item of orderItems) {
        if (!item.variantId) continue;

        // Find inventory item for this variant
        const inventoryItem = await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(eq(inventoryItems.variantId, item.variantId))
          .limit(1);

        if (inventoryItem.length === 0) continue;

        const invItemId = inventoryItem[0].id;

        // Find or create inventory level (row locking handled by transaction)
        let inventoryLevel = await tx
          .select()
          .from(inventoryLevels)
          .where(
            and(
              eq(inventoryLevels.inventoryItemId, invItemId),
              eq(inventoryLevels.locationId, locationId)
            )
          )
          .limit(1);

        if (inventoryLevel.length === 0) {
          // Create inventory level if it doesn't exist
          await tx.insert(inventoryLevels).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            available: 0,
            committed: 0,
            incoming: 0,
            onHand: 0,
            shipped: 0,
            damaged: 0,
            returned: 0,
          });
          inventoryLevel = await tx
            .select()
            .from(inventoryLevels)
            .where(
              and(
                eq(inventoryLevels.inventoryItemId, invItemId),
                eq(inventoryLevels.locationId, locationId)
              )
            )
            .limit(1);
        }

        const level = inventoryLevel[0];
        const quantity = item.quantity;

        if (direction === "reserve") {
          // available -= qty, committed += qty
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: -quantity,
            reason: reason,
            eventType: eventType,
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: session.user.id,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              available: sql`${inventoryLevels.available} - ${quantity}`,
              committed: sql`${inventoryLevels.committed} + ${quantity}`,
              onHand: sql`${inventoryLevels.available} - ${quantity} + ${inventoryLevels.committed} + ${quantity}`, // Calculate on_hand
              updatedAt: new Date(),
            })
            .where(eq(inventoryLevels.id, level.id));
        } else if (direction === "release") {
          // committed -= qty, available += qty
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: quantity,
            reason: reason,
            eventType: eventType,
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: session.user.id,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              committed: sql`${inventoryLevels.committed} - ${quantity}`,
              available: sql`${inventoryLevels.available} + ${quantity}`,
              onHand: sql`${inventoryLevels.available} + ${quantity} + ${inventoryLevels.committed} - ${quantity}`, // Calculate on_hand
              updatedAt: new Date(),
            })
            .where(eq(inventoryLevels.id, level.id));
        } else if (direction === "fulfill") {
          // committed -= qty, shipped += qty (no change to available)
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: -quantity, // Negative because committed decreases
            reason: reason,
            eventType: eventType,
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: session.user.id,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              committed: sql`${inventoryLevels.committed} - ${quantity}`,
              shipped: sql`${inventoryLevels.shipped} + ${quantity}`,
              onHand: sql`${inventoryLevels.available} + ${inventoryLevels.committed} - ${quantity}`, // Calculate on_hand
              updatedAt: new Date(),
            })
            .where(eq(inventoryLevels.id, level.id));
        } else if (direction === "commit") {
          // committed -= qty, on_hand -= qty (payment captured - inventory committed to sale)
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: -quantity, // Negative because committed decreases
            reason: reason,
            eventType: eventType,
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: session.user.id,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              committed: sql`${inventoryLevels.committed} - ${quantity}`,
              onHand: sql`${inventoryLevels.available} + ${inventoryLevels.committed} - ${quantity}`, // Calculate on_hand (committed reduced)
              updatedAt: new Date(),
            })
            .where(eq(inventoryLevels.id, level.id));
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to adjust inventory",
    };
  }
}

/**
 * List orders with filters and pagination
 */
export async function listOrders(filters: OrderFilters = {}): Promise<{
  success: boolean;
  data?: OrderRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const { storeId, isAdmin, error: storeError } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    // Build where conditions
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> =
      [];

    if (!isAdmin && storeId) {
      // For stores, show orders that have at least one item from their listings
      // This ensures stores see orders with their products, even if order.storeId is set to a different store
      // (e.g., when an admin creates an order with items from multiple stores)
      conditions.push(
        sql`EXISTS (
          SELECT 1 
          FROM ${orderItems} oi
          INNER JOIN ${listing} l ON oi.listing_id = l.id
          WHERE oi.order_id = ${orders.id}
          AND l.store_id = ${storeId}
        )`
      );
    }

    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      conditions.push(
        eq(
          orders.paymentStatus,
          filters.paymentStatus as
            | "pending"
            | "paid"
            | "partially_refunded"
            | "refunded"
            | "failed"
            | "void"
        )
      );
    }

    if (filters.fulfillmentStatus && filters.fulfillmentStatus !== "all") {
      conditions.push(
        eq(
          orders.fulfillmentStatus,
          filters.fulfillmentStatus as
            | "unfulfilled"
            | "partial"
            | "fulfilled"
            | "canceled"
            | "on_hold"
        )
      );
    }

    if (filters.status && filters.status !== "all") {
      conditions.push(
        eq(
          orders.status,
          filters.status as "open" | "draft" | "archived" | "canceled"
        )
      );
    }

    // Filter by archived status
    if (filters.archived !== undefined) {
      if (filters.archived) {
        conditions.push(sql`${orders.archivedAt} IS NOT NULL`);
      } else {
        conditions.push(sql`${orders.archivedAt} IS NULL`);
      }
    }

    // Build search condition
    let searchCondition;
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      searchCondition = or(
        sql`CAST(${orders.orderNumber} AS TEXT) ILIKE ${searchTerm}`,
        sql`${orders.customerEmail} ILIKE ${searchTerm}`,
        sql`${orders.customerFirstName} ILIKE ${searchTerm}`,
        sql`${orders.customerLastName} ILIKE ${searchTerm}`,
        sql`CONCAT(${orders.customerFirstName}, ' ', ${orders.customerLastName}) ILIKE ${searchTerm}`
      );
    }

    // Get total count
    // For stores, we need to ensure we're counting distinct orders that match the conditions
    const countQuery = db
      .selectDistinct({ id: orders.id })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(listing, eq(orderItems.listingId, listing.id))
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      );

    const countResult = await countQuery;
    const totalCount = countResult.length;

    // Build sort - default to latest orders (by date, descending)
    const sortBy = filters.sortBy || "date";
    const sortDirection = filters.sortDirection || "desc";
    const sortColumn =
      sortBy === "orderNumber"
        ? orders.orderNumber
        : sortBy === "date"
          ? sql`COALESCE(${orders.placedAt}, ${orders.createdAt})` // Use placedAt if available, otherwise createdAt
          : sortBy === "total"
            ? orders.totalAmount
            : sortBy === "paymentStatus"
              ? orders.paymentStatus
              : sortBy === "fulfillmentStatus"
                ? orders.fulfillmentStatus
                : sql`COALESCE(${orders.placedAt}, ${orders.createdAt})`; // Default to date sorting

    const orderBy =
      sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated data
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // For stores, we need to count only items from their listings
    // For admins, count all items
    let itemsCountExpression: ReturnType<typeof sql<number>>;

    if (!isAdmin && storeId) {
      // Count only items from this store's listings
      itemsCountExpression = sql<number>`COUNT(CASE WHEN ${listing.storeId} = ${storeId} THEN ${orderItems.id} END)::int`;
    } else {
      // Count all items
      itemsCountExpression = sql<number>`COUNT(${orderItems.id})::int`;
    }

    const data = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        customerEmail: orders.customerEmail,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
        placedAt: orders.placedAt,
        createdAt: orders.createdAt,
        shippingMethod: orders.shippingMethod,
        archivedAt: orders.archivedAt,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingCity: orders.shippingCity,
        shippingCountry: orders.shippingCountry,
        itemsCount: itemsCountExpression,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(listing, eq(orderItems.listingId, listing.id))
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      )
      .groupBy(
        orders.id,
        orders.orderNumber,
        orders.customerFirstName,
        orders.customerLastName,
        orders.customerEmail,
        orders.totalAmount,
        orders.currency,
        orders.paymentStatus,
        orders.fulfillmentStatus,
        orders.status,
        orders.placedAt,
        orders.createdAt,
        orders.shippingMethod,
        orders.archivedAt,
        orders.shippingAddressLine1,
        orders.shippingCity,
        orders.shippingCountry
      )
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      data: data.map((row) => {
        // Derive warning flags
        const hasAddressWarning =
          !row.shippingAddressLine1 ||
          !row.shippingCity ||
          !row.shippingCountry;
        const hasRiskWarning = false; // TODO: Implement risk detection logic

        return {
          ...row,
          itemsCount: Number(row.itemsCount) || 0,
          hasAddressWarning,
          hasRiskWarning,
        } as OrderRow;
      }),
      totalCount,
    };
  } catch (error) {
    console.error("Error listing orders:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list orders",
    };
  }
}

/**
 * Create a new order
 */
export async function createOrder(input: CreateOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  try {
    const { storeId, isAdmin, error: storeError } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    if (!isAdmin && !storeId) {
      return { success: false, error: "Store not found" };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Use provided storeId or get from user
    let finalStoreId = storeId;

    // For admins, determine storeId from line items
    // Get storeId from all line items to ensure we assign customer to the correct store
    if (isAdmin && input.lineItems && input.lineItems.length > 0) {
      // Get all unique listing IDs from line items
      const listingIds = [
        ...new Set(input.lineItems.map((item) => item.listingId)),
      ];

      // Get store IDs for all listings
      const listingsResult = await db
        .select({ storeId: listing.storeId })
        .from(listing)
        .where(inArray(listing.id, listingIds));

      // Get unique store IDs
      const storeIds = [
        ...new Set(
          listingsResult
            .map((l) => l.storeId)
            .filter((id): id is string => id !== null)
        ),
      ];

      // If all items are from one store, use that storeId
      // If items are from multiple stores, use the first store (or we could use the majority)
      if (storeIds.length === 1) {
        finalStoreId = storeIds[0];
      } else if (storeIds.length > 1 && !finalStoreId) {
        // Multiple stores - use the first one
        // In the future, we might want to create separate customer records per store
        finalStoreId = storeIds[0];
      } else if (storeIds.length === 0 && !finalStoreId) {
        // No store found in listings - try to get from first listing
        const firstListingId = input.lineItems[0].listingId;
        const listingResult = await db
          .select({ storeId: listing.storeId })
          .from(listing)
          .where(eq(listing.id, firstListingId))
          .limit(1);

        if (listingResult.length > 0 && listingResult[0].storeId) {
          finalStoreId = listingResult[0].storeId;
        }
      }
    }

    // If still no storeId, allow null for admins (storeId is nullable in schema)
    // For non-admins, storeId should already be set from getStoreIdForUser

    return await db.transaction(async (tx) => {
      // Handle customer creation/finding according to edge case logic
      let customerId = input.customerId;

      if (!customerId && input.customerEmail) {
        // Check if this email belongs to the logged-in user
        const isLoggedInUser =
          userEmail &&
          userEmail.toLowerCase() === input.customerEmail.toLowerCase();

        let existingCustomer;

        if (isLoggedInUser) {
          // Priority 1: If email matches logged-in user, first check by userId
          existingCustomer = await tx
            .select({
              id: customers.id,
              userId: customers.userId,
              storeId: customers.storeId,
            })
            .from(customers)
            .where(eq(customers.userId, userId))
            .limit(1);

          // Priority 2: If no customer found by userId, check by email (regardless of storeId)
          // This handles cases where customer was created before userId linking was implemented
          if (existingCustomer.length === 0) {
            existingCustomer = await tx
              .select({
                id: customers.id,
                userId: customers.userId,
                storeId: customers.storeId,
              })
              .from(customers)
              .where(eq(customers.email, input.customerEmail))
              .limit(1);
          }
        } else {
          // For other users' emails: Check if customer exists with SAME email AND SAME storeId
          // This ensures store isolation for different users
          existingCustomer = await tx
            .select({
              id: customers.id,
              userId: customers.userId,
              storeId: customers.storeId,
            })
            .from(customers)
            .where(
              and(
                eq(customers.email, input.customerEmail),
                finalStoreId
                  ? eq(customers.storeId, finalStoreId)
                  : isNull(customers.storeId)
              )
            )
            .limit(1);
        }

        if (existingCustomer.length > 0) {
          // Found existing customer - use it and update if needed
          const customer = existingCustomer[0];

          // Update customer record if needed
          const updateData: {
            storeId?: string | null;
            userId?: string;
            firstName?: string | null;
            lastName?: string | null;
            phone?: string | null;
          } = {};

          // Link userId if this is the logged-in user and userId is missing
          if (isLoggedInUser && !customer.userId) {
            updateData.userId = userId;
          }

          // Update storeId if customer has null storeId but we have one
          if (finalStoreId && !customer.storeId) {
            updateData.storeId = finalStoreId;
          }

          if (Object.keys(updateData).length > 0) {
            await tx
              .update(customers)
              .set(updateData)
              .where(eq(customers.id, customer.id));
          }

          customerId = customer.id;
        } else {
          // No existing customer found - create a new one
          const newCustomer = await tx
            .insert(customers)
            .values({
              storeId: finalStoreId,
              userId: isLoggedInUser ? userId : null, // Link to user if it's the logged-in user
              email: input.customerEmail,
              firstName: input.customerFirstName || null,
              lastName: input.customerLastName || null,
              phone: input.customerPhone || null,
            })
            .returning();

          customerId = newCustomer[0].id;
        }
      }

      // Check stock availability before creating order (only for "open" status)
      const orderStatus = input.status || "open";
      if (orderStatus === "open" && finalStoreId) {
        const stockCheck = await checkStockAvailability(
          input.lineItems.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          finalStoreId
        );

        if (!stockCheck.success) {
          // Get variant details for error message
          const variantIds =
            stockCheck.unavailableItems?.map((item) => item.variantId) || [];
          if (variantIds.length > 0) {
            const variantDetails = await tx
              .select({
                id: listingVariants.id,
                title: listingVariants.title,
                listingName: listing.name,
              })
              .from(listingVariants)
              .innerJoin(listing, eq(listingVariants.listingId, listing.id))
              .where(inArray(listingVariants.id, variantIds));

            const errorMessages = variantDetails.map((variant) => {
              const unavailableItem = stockCheck.unavailableItems?.find(
                (item) => item.variantId === variant.id
              );
              return `${variant.listingName} - ${variant.title}: ${unavailableItem?.available || 0} available, ${unavailableItem?.requested || 0} requested`;
            });

            return {
              success: false,
              error: `Insufficient stock:\n${errorMessages.join("\n")}`,
            };
          }
          return {
            success: false,
            error:
              stockCheck.error || "Insufficient stock for one or more items",
          };
        }
      }

      const paymentStatus = input.paymentStatus || "pending";
      const fulfillmentStatus = input.fulfillmentStatus || "unfulfilled";

      // Get user's marketId for snapshot
      const userData = await tx
        .select({ marketId: user.marketId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const userMarketId = userData.length > 0 ? userData[0].marketId : null;

      const newOrder = await tx
        .insert(orders)
        .values({
          storeId: finalStoreId,
          marketId: userMarketId, // Snapshot market at transaction time
          customerId: customerId || null,
          customerEmail: input.customerEmail,
          customerFirstName: input.customerFirstName || null,
          customerLastName: input.customerLastName || null,
          currency: input.currency,
          subtotalAmount: input.subtotalAmount,
          discountAmount: input.discountAmount || "0",
          shippingAmount: input.shippingAmount || "0",
          taxAmount: input.taxAmount || "0",
          totalAmount: input.totalAmount,
          status: orderStatus,
          paymentStatus: paymentStatus,
          fulfillmentStatus: fulfillmentStatus,
          shippingName: input.shippingName || null,
          shippingPhone: input.shippingPhone || null,
          shippingAddressLine1: input.shippingAddressLine1 || null,
          shippingAddressLine2: input.shippingAddressLine2 || null,
          shippingCity: input.shippingCity || null,
          shippingRegion: input.shippingRegion || null,
          shippingPostalCode: input.shippingPostalCode || null,
          shippingCountry: input.shippingCountry || null,
          billingName: input.billingName || null,
          billingPhone: input.billingPhone || null,
          billingAddressLine1: input.billingAddressLine1 || null,
          billingAddressLine2: input.billingAddressLine2 || null,
          billingCity: input.billingCity || null,
          billingRegion: input.billingRegion || null,
          billingPostalCode: input.billingPostalCode || null,
          billingCountry: input.billingCountry || null,
          notes: input.notes || null,
          tags: input.tags || null,
          placedAt: orderStatus === "open" ? new Date() : null,
          paidAt: paymentStatus === "paid" ? new Date() : null,
        })
        .returning();

      const orderId = newOrder[0].id;
      const orderNumber = newOrder[0].orderNumber;

      // Create order items
      for (const item of input.lineItems) {
        const lineSubtotal = (
          parseFloat(item.unitPrice) * item.quantity
        ).toFixed(2);
        const lineTotal = lineSubtotal; // No discounts for now

        await tx.insert(orderItems).values({
          orderId: orderId,
          listingId: item.listingId,
          variantId: item.variantId || null,
          title: item.title,
          sku: item.sku || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: input.currency,
          lineSubtotal: lineSubtotal,
          lineTotal: lineTotal,
          discountAmount: "0",
          taxAmount: "0",
        });
      }

      // Adjust inventory if order is "open" (not draft)
      if (orderStatus === "open" && finalStoreId) {
        const inventoryResult = await adjustInventoryForOrder(
          input.lineItems.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          finalStoreId,
          "reserve",
          "order_created",
          orderId
        );

        if (!inventoryResult.success) {
          throw new Error(
            inventoryResult.error || "Failed to adjust inventory"
          );
        }
      }

      return {
        success: true,
        orderId,
        orderNumber: Number(orderNumber),
      };
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order",
    };
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  orderId: string,
  newStatus:
    | "pending"
    | "paid"
    | "partially_refunded"
    | "refunded"
    | "failed"
    | "void"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    const permissionCheck = await canChangeStatus("payment");
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.error };
    }

    // Get current order state
    const orderData = await db
      .select({
        paymentStatus: orders.paymentStatus,
        status: orders.status,
        storeId: orders.storeId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const currentPaymentStatus = orderData[0].paymentStatus;
    const orderStatus = orderData[0].status;
    const storeId = orderData[0].storeId;

    // Validate transition
    if (!canTransitionPaymentStatus(currentPaymentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentPaymentStatus} → ${newStatus}`,
      };
    }

    // Get order items for inventory adjustments
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Wrap everything in a transaction
    await db.transaction(async (tx) => {
      // Handle inventory adjustments based on transition
      if (currentPaymentStatus === "pending" && newStatus === "paid") {
        // pending → paid: Commit inventory (reduce committed, reduce on_hand)
        if (storeId && orderStatus === "open") {
          // Get fulfillment status to check if already fulfilled
          const orderFulfillment = await tx
            .select({ fulfillmentStatus: orders.fulfillmentStatus })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

          const fulfillmentStatus = orderFulfillment[0]?.fulfillmentStatus;

          // Only commit inventory if not yet fulfilled
          // If already fulfilled, inventory was already adjusted during fulfillment
          if (
            fulfillmentStatus === "unfulfilled" ||
            fulfillmentStatus === "partial"
          ) {
            const inventoryResult = await adjustInventoryForOrder(
              items.map((item) => ({
                variantId: item.variantId || null,
                quantity: item.quantity,
              })),
              storeId,
              "commit", // committed -= qty, on_hand -= qty
              "payment_captured",
              orderId
            );

            if (!inventoryResult.success) {
              throw new Error(
                inventoryResult.error || "Failed to commit inventory"
              );
            }
          }
        }

        // Update order
        await tx
          .update(orders)
          .set({
            paymentStatus: newStatus,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (
        currentPaymentStatus === "pending" &&
        (newStatus === "failed" || newStatus === "void")
      ) {
        // pending → failed/void: Release inventory reservation
        if (storeId && orderStatus === "open") {
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity,
            })),
            storeId,
            "release",
            `payment_${newStatus}`,
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to release inventory"
            );
          }
        }

        // Update order
        await tx
          .update(orders)
          .set({
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (
        (currentPaymentStatus === "paid" ||
          currentPaymentStatus === "partially_refunded") &&
        (newStatus === "partially_refunded" || newStatus === "refunded")
      ) {
        // paid/partially_refunded → partially_refunded/refunded
        // Note: Inventory restocking should be handled separately when items are returned
        // This is just accounting - no inventory change unless items are physically returned

        await tx
          .update(orders)
          .set({
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else {
        // Other transitions (shouldn't happen with validation, but handle gracefully)
        await tx
          .update(orders)
          .set({
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating payment status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update payment status",
    };
  }
}

/**
 * Update fulfillment status
 */
export async function updateFulfillmentStatus(
  orderId: string,
  newStatus: "unfulfilled" | "partial" | "fulfilled" | "canceled" | "on_hold"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    const permissionCheck = await canChangeStatus("fulfillment");
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.error };
    }

    const { storeId, error: storeError } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    // Get current order state
    const currentOrder = await db
      .select({
        fulfillmentStatus: orders.fulfillmentStatus,
        paymentStatus: orders.paymentStatus,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (currentOrder.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const currentFulfillmentStatus = currentOrder[0].fulfillmentStatus;
    const paymentStatus = currentOrder[0].paymentStatus;
    const orderStatus = currentOrder[0].status;

    // Validate transition
    if (!canTransitionFulfillmentStatus(currentFulfillmentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentFulfillmentStatus} → ${newStatus}`,
      };
    }

    // Get order items
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Wrap in transaction
    await db.transaction(async (tx) => {
      // Handle transitions
      if (
        currentFulfillmentStatus === "unfulfilled" &&
        newStatus === "partial"
      ) {
        // unfulfilled → partial: Some items shipped
        // Increase shipped for partial quantity (you may need to pass actual shipped qty)
        // For now, we'll mark as partial - actual quantity tracking should be in shipment records
        if (storeId) {
          // Note: For partial fulfillment, you need to track which items/quantities were shipped
          // This is a simplified version - you may want to add shipment tracking
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity, // This should be the actual shipped quantity
            })),
            storeId,
            "fulfill", // This will decrease committed and increase shipped
            "partial_fulfillment",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to update inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (
        currentFulfillmentStatus === "partial" &&
        newStatus === "fulfilled"
      ) {
        // partial → fulfilled: Remaining items shipped
        // Increase shipped for remaining quantity
        if (storeId) {
          // Note: This should be the remaining quantity, not total
          // You need to track what was already shipped
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity, // This should be remaining quantity
            })),
            storeId,
            "fulfill",
            "fulfillment_completed",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to update inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            fulfilledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (
        currentFulfillmentStatus === "unfulfilled" &&
        newStatus === "fulfilled"
      ) {
        // unfulfilled → fulfilled: All items shipped at once
        if (storeId) {
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity,
            })),
            storeId,
            "fulfill",
            "order_fulfilled",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to update inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            fulfilledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (
        (currentFulfillmentStatus === "unfulfilled" ||
          currentFulfillmentStatus === "partial") &&
        newStatus === "canceled"
      ) {
        // unfulfilled/partial → canceled: Release inventory if not shipped
        if (storeId && orderStatus === "open") {
          // Only release if order is still open (inventory was reserved)
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity, // Should be remaining unshipped quantity
            })),
            storeId,
            "release",
            "fulfillment_canceled",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to release inventory"
            );
          }
        }

        // If paid, should trigger refund (handled separately)
        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            status:
              paymentStatus === "paid" ? ("canceled" as const) : orders.status,
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (newStatus === "on_hold") {
        // any → on_hold: No inventory change, just flag
        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else {
        // Other transitions (on_hold → others)
        await tx
          .update(orders)
          .set({
            fulfillmentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating fulfillment status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update fulfillment status",
    };
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: "open" | "draft" | "archived" | "canceled"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isAdmin, storeId } = await getStoreIdForUser();

    // Get current order state
    const orderData = await db
      .select({
        status: orders.status,
        storeId: orders.storeId,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const currentStatus = orderData[0].status;
    const orderStoreId = orderData[0].storeId;
    const paymentStatus = orderData[0].paymentStatus;
    const fulfillmentStatus = orderData[0].fulfillmentStatus;

    // Validate transition
    if (!canTransitionOrderStatus(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${newStatus}`,
      };
    }

    // Check permissions: Sellers can only cancel/archive their orders
    if (!isAdmin && storeId) {
      if (newStatus === "canceled" || newStatus === "archived") {
        // Sellers can cancel/archive orders
        // But check if order belongs to them or contains their items
        if (orderStoreId !== storeId) {
          // Check if order has items from this store
          const orderItemsWithStores = await db
            .select({ storeId: listing.storeId })
            .from(orderItems)
            .innerJoin(listing, eq(orderItems.listingId, listing.id))
            .where(eq(orderItems.orderId, orderId));

          const hasStoreItems = orderItemsWithStores.some(
            (item) => item.storeId === storeId
          );

          if (!hasStoreItems) {
            return {
              success: false,
              error: "You don't have permission to modify this order",
            };
          }
        }
      } else {
        // Sellers cannot change to draft or open
        return {
          success: false,
          error: "Only admins can change order status to draft or open",
        };
      }
    }

    // Get order items
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Wrap in transaction
    await db.transaction(async (tx) => {
      // Handle transitions
      if (currentStatus === "draft" && newStatus === "open") {
        // draft → open: Reserve inventory
        if (orderStoreId) {
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity,
            })),
            orderStoreId,
            "reserve",
            "order_confirmed",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to reserve inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            status: newStatus,
            placedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (currentStatus === "open" && newStatus === "canceled") {
        // open → canceled: Release inventory if pending, refund if paid
        if (orderStoreId) {
          // Release inventory if not yet fulfilled
          if (
            fulfillmentStatus === "unfulfilled" ||
            fulfillmentStatus === "partial"
          ) {
            const inventoryResult = await adjustInventoryForOrder(
              items.map((item) => ({
                variantId: item.variantId || null,
                quantity: item.quantity, // Should be remaining unshipped
              })),
              orderStoreId,
              "release",
              "order_canceled",
              orderId
            );

            if (!inventoryResult.success) {
              throw new Error(
                inventoryResult.error || "Failed to release inventory"
              );
            }
          }
        }

        // If paid, should trigger refund (handled separately or via payment status update)
        await tx
          .update(orders)
          .set({
            status: newStatus,
            canceledAt: new Date(),
            updatedAt: new Date(),
            // Optionally auto-update payment status if paid
            paymentStatus:
              paymentStatus === "paid"
                ? ("refunded" as const)
                : orders.paymentStatus,
          })
          .where(eq(orders.id, orderId));
      } else if (currentStatus === "open" && newStatus === "archived") {
        // open → archived: No inventory change, just mark as closed
        await tx
          .update(orders)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (currentStatus === "open" && newStatus !== "open") {
        // open → draft/archived: Release inventory
        if (orderStoreId) {
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity,
            })),
            orderStoreId,
            "release",
            `order_status_changed_to_${newStatus}`,
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to release inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else if (currentStatus !== "open" && newStatus === "open") {
        // draft/archived/canceled → open: Reserve inventory
        if (orderStoreId) {
          const inventoryResult = await adjustInventoryForOrder(
            items.map((item) => ({
              variantId: item.variantId || null,
              quantity: item.quantity,
            })),
            orderStoreId,
            "reserve",
            "order_status_changed_to_open",
            orderId
          );

          if (!inventoryResult.success) {
            throw new Error(
              inventoryResult.error || "Failed to reserve inventory"
            );
          }
        }

        await tx
          .update(orders)
          .set({
            status: newStatus,
            placedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      } else {
        // Other transitions (shouldn't happen with validation)
        await tx
          .update(orders)
          .set({
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, orderId));
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update order status",
    };
  }
}

/**
 * Delete a single order
 */
export async function deleteOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user has permission to delete this order
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get order to check ownership
    const orderData = await db
      .select({ storeId: orders.storeId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    // Check permissions: admin can delete any order
    // Stores can only delete orders that contain ONLY their products
    if (!isAdmin && storeId) {
      // Check if order has items from other stores
      const orderItemsWithStores = await db
        .select({ storeId: listing.storeId })
        .from(orderItems)
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(eq(orderItems.orderId, orderId));

      const uniqueStoreIds = [
        ...new Set(
          orderItemsWithStores
            .map((item) => item.storeId)
            .filter((id): id is string => id !== null)
        ),
      ];

      // Store can only delete if order contains ONLY their products
      // (This works regardless of orders.storeId - admin orders with only this store's products can be deleted)
      if (
        uniqueStoreIds.length > 1 ||
        (uniqueStoreIds.length === 1 && uniqueStoreIds[0] !== storeId)
      ) {
        return {
          success: false,
          error:
            "You cannot delete this order because it contains items from other stores",
        };
      }
      // Note: We don't check orders.storeId here - we only care about the items in the order
    }

    // Get order status and items before deleting to release inventory if needed
    const orderInfo = await db
      .select({
        status: orders.status,
        storeId: orders.storeId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderInfo.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const orderStatus = orderInfo[0].status;
    const orderStoreId = orderInfo[0].storeId;

    // Get order items for inventory release
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Release inventory if order status was "open" (inventory was reserved)
    if (orderStatus === "open" && orderStoreId) {
      const inventoryResult = await adjustInventoryForOrder(
        items.map((item) => ({
          variantId: item.variantId || null,
          quantity: item.quantity,
        })),
        orderStoreId,
        "release",
        "order_deleted",
        orderId
      );

      if (!inventoryResult.success) {
        return {
          success: false,
          error: inventoryResult.error || "Failed to release inventory",
        };
      }
    }

    // Before deleting order, restore the associated draft order
    // Set convertedToOrderId to null and completed to false so it appears in drafts table again
    await db
      .update(draftOrders)
      .set({
        convertedToOrderId: null,
        completed: false,
        completedAt: null,
      })
      .where(eq(draftOrders.convertedToOrderId, orderId));

    // Delete order (cascade will handle orderItems, orderPayments, fulfillments)
    // Note: The foreign key constraint will automatically set convertedToOrderId to null
    // in draft_orders table, so the draft will remain but won't reference the deleted order
    await db.delete(orders).where(eq(orders.id, orderId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete order",
    };
  }
}

/**
 * Get order details with items
 */
export async function getOrderWithItems(orderId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    orderNumber: number;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    currency: string;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    placedAt: Date | null;
    createdAt: Date;
    archivedAt: Date | null;
    internalNote: string | null;
    notes: string | null;
    tags: string | null;
    shippingMethod: string | null;
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    billingName: string | null;
    billingPhone: string | null;
    billingAddressLine1: string | null;
    billingAddressLine2: string | null;
    billingCity: string | null;
    billingRegion: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
    paidAt: Date | null;
    fulfilledAt: Date | null;
    canceledAt: Date | null;
    items: Array<{
      id: string;
      title: string;
      sku: string | null;
      quantity: number;
      unitPrice: string;
      lineSubtotal: string;
      lineTotal: string;
      currency: string;
      imageUrl: string | null;
    }>;
    events: Array<{
      id: string;
      type: string;
      visibility: string;
      message: string;
      metadata: Record<string, unknown> | null;
      createdBy: string | null;
      createdAt: Date;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate orderId format (should be a valid UUID)
    if (!orderId || typeof orderId !== "string" || orderId.length !== 36) {
      return { success: false, error: "Invalid order ID" };
    }

    // Get order with all fields
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        currency: orders.currency,
        subtotalAmount: orders.subtotalAmount,
        discountAmount: orders.discountAmount,
        shippingAmount: orders.shippingAmount,
        taxAmount: orders.taxAmount,
        totalAmount: orders.totalAmount,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        placedAt: orders.placedAt,
        createdAt: orders.createdAt,
        storeId: orders.storeId,
        archivedAt: orders.archivedAt,
        internalNote: orders.internalNote,
        notes: orders.notes,
        tags: orders.tags,
        shippingMethod: orders.shippingMethod,
        shippingName: orders.shippingName,
        shippingPhone: orders.shippingPhone,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingAddressLine2: orders.shippingAddressLine2,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        shippingPostalCode: orders.shippingPostalCode,
        shippingCountry: orders.shippingCountry,
        billingName: orders.billingName,
        billingPhone: orders.billingPhone,
        billingAddressLine1: orders.billingAddressLine1,
        billingAddressLine2: orders.billingAddressLine2,
        billingCity: orders.billingCity,
        billingRegion: orders.billingRegion,
        billingPostalCode: orders.billingPostalCode,
        billingCountry: orders.billingCountry,
        paidAt: orders.paidAt,
        fulfilledAt: orders.fulfilledAt,
        canceledAt: orders.canceledAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions
    if (!isAdmin && order.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to view this order",
      };
    }

    // Get order items with images from listing/variant
    // For stores, only show items that belong to their listings
    const itemConditions: Array<ReturnType<typeof eq>> = [
      eq(orderItems.orderId, orderId),
    ];

    if (!isAdmin && storeId) {
      // Filter items to only show those from this store's listings
      itemConditions.push(eq(listing.storeId, storeId));
    }

    const items = await db
      .select({
        id: orderItems.id,
        title: orderItems.title,
        sku: orderItems.sku,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineSubtotal: orderItems.lineSubtotal,
        lineTotal: orderItems.lineTotal,
        currency: orderItems.currency,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
      })
      .from(orderItems)
      .innerJoin(listing, eq(orderItems.listingId, listing.id))
      .leftJoin(listingVariants, eq(orderItems.variantId, listingVariants.id))
      .where(and(...itemConditions));

    // Get order events for timeline
    const events = await db
      .select({
        id: orderEvents.id,
        type: orderEvents.type,
        visibility: orderEvents.visibility,
        message: orderEvents.message,
        metadata: orderEvents.metadata,
        createdBy: orderEvents.createdBy,
        createdAt: orderEvents.createdAt,
      })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.createdAt));

    return {
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerFirstName: order.customerFirstName,
        customerLastName: order.customerLastName,
        currency: order.currency,
        subtotalAmount: order.subtotalAmount,
        discountAmount: order.discountAmount,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        placedAt: order.placedAt,
        createdAt: order.createdAt,
        archivedAt: order.archivedAt,
        internalNote: order.internalNote,
        notes: order.notes,
        tags: order.tags,
        shippingMethod: order.shippingMethod,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        shippingAddressLine1: order.shippingAddressLine1,
        shippingAddressLine2: order.shippingAddressLine2,
        shippingCity: order.shippingCity,
        shippingRegion: order.shippingRegion,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        billingName: order.billingName,
        billingPhone: order.billingPhone,
        billingAddressLine1: order.billingAddressLine1,
        billingAddressLine2: order.billingAddressLine2,
        billingCity: order.billingCity,
        billingRegion: order.billingRegion,
        billingPostalCode: order.billingPostalCode,
        billingCountry: order.billingCountry,
        paidAt: order.paidAt,
        fulfilledAt: order.fulfilledAt,
        canceledAt: order.canceledAt,
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineSubtotal: item.lineSubtotal,
          lineTotal: item.lineTotal,
          currency: item.currency,
          imageUrl: item.variantImageUrl || item.listingImageUrl || null,
        })),
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          visibility: event.visibility,
          message: event.message,
          metadata: event.metadata as Record<string, unknown> | null,
          createdBy: event.createdBy,
          createdAt: event.createdAt,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching order with items:", error);
    // Handle database errors gracefully
    if (error instanceof Error) {
      // Check if it's a database query error
      if (
        error.message.includes("Failed query") ||
        error.message.includes("invalid input syntax")
      ) {
        return {
          success: false,
          error: "Invalid order ID format",
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Failed to fetch order",
    };
  }
}

/**
 * Archive multiple orders
 */
export async function archiveOrders(
  orderIds: string[]
): Promise<{ success: boolean; archivedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get orders to check permissions and state
    const ordersData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        archivedAt: orders.archivedAt,
        status: orders.status,
      })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    if (ordersData.length === 0) {
      return { success: false, error: "No orders found" };
    }

    // Filter orders that can be archived (not already archived)
    const ordersToArchive = ordersData.filter(
      (order) => !order.archivedAt && order.status !== "archived"
    );

    if (ordersToArchive.length === 0) {
      return {
        success: false,
        error: "No orders can be archived (already archived or invalid status)",
      };
    }

    // Check permissions for each order
    const validOrderIds: string[] = [];
    for (const order of ordersToArchive) {
      if (isAdmin) {
        validOrderIds.push(order.id);
      } else if (storeId && order.storeId === storeId) {
        validOrderIds.push(order.id);
      }
    }

    if (validOrderIds.length === 0) {
      return {
        success: false,
        error: "You don't have permission to archive these orders",
      };
    }

    // Archive orders
    await db
      .update(orders)
      .set({
        archivedAt: new Date(),
        status: "archived",
        updatedAt: new Date(),
      })
      .where(inArray(orders.id, validOrderIds));

    return {
      success: true,
      archivedCount: validOrderIds.length,
    };
  } catch (error) {
    console.error("Error archiving orders:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to archive orders",
    };
  }
}

/**
 * Unarchive multiple orders
 */
export async function unarchiveOrders(
  orderIds: string[]
): Promise<{ success: boolean; unarchivedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get orders to check permissions and state
    const ordersData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        archivedAt: orders.archivedAt,
      })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    if (ordersData.length === 0) {
      return { success: false, error: "No orders found" };
    }

    // Filter orders that can be unarchived (already archived)
    const ordersToUnarchive = ordersData.filter((order) => order.archivedAt);

    if (ordersToUnarchive.length === 0) {
      return {
        success: false,
        error: "No orders can be unarchived (not archived)",
      };
    }

    // Check permissions for each order
    const validOrderIds: string[] = [];
    for (const order of ordersToUnarchive) {
      if (isAdmin) {
        validOrderIds.push(order.id);
      } else if (storeId && order.storeId === storeId) {
        validOrderIds.push(order.id);
      }
    }

    if (validOrderIds.length === 0) {
      return {
        success: false,
        error: "You don't have permission to unarchive these orders",
      };
    }

    // Unarchive orders (set archivedAt to null, status back to open)
    await db
      .update(orders)
      .set({
        archivedAt: null,
        status: "open",
        updatedAt: new Date(),
      })
      .where(inArray(orders.id, validOrderIds));

    return {
      success: true,
      unarchivedCount: validOrderIds.length,
    };
  } catch (error) {
    console.error("Error unarchiving orders:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to unarchive orders",
    };
  }
}

/**
 * Delete multiple orders
 */
export async function deleteOrders(
  orderIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get orders to check permissions
    const ordersData = await db
      .select({ id: orders.id, storeId: orders.storeId })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    // Filter orders based on permissions
    let ordersToDelete: string[];

    if (isAdmin) {
      // Admin can delete any order
      ordersToDelete = ordersData.map((o) => o.id);
    } else if (storeId) {
      // Stores can only delete orders that contain ONLY their products
      const ordersWithItems = await db
        .select({
          orderId: orderItems.orderId,
          storeId: listing.storeId,
        })
        .from(orderItems)
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(inArray(orderItems.orderId, orderIds));

      // Group by orderId and check if each order has items from only this store
      const orderStoreMap = new Map<string, Set<string>>();
      ordersWithItems.forEach((item) => {
        if (item.storeId) {
          const current = orderStoreMap.get(item.orderId) || new Set();
          current.add(item.storeId);
          orderStoreMap.set(item.orderId, current);
        }
      });

      // Filter orders: only include if they have items from only this store (or no items)
      ordersToDelete = ordersData
        .filter((order) => {
          const storesInOrder = orderStoreMap.get(order.id);
          // Allow if: no items, or only this store's items
          // Don't check order.storeId - we only care about the items
          return (
            !storesInOrder ||
            storesInOrder.size === 0 ||
            (storesInOrder.size === 1 && storesInOrder.has(storeId))
          );
        })
        .map((o) => o.id);
    } else {
      ordersToDelete = [];
    }

    if (ordersToDelete.length === 0) {
      return {
        success: false,
        error: "You don't have permission to delete any of the selected orders",
      };
    }

    // Get order statuses and items before deleting to release inventory if needed
    const ordersToDeleteInfo = await db
      .select({
        id: orders.id,
        status: orders.status,
        storeId: orders.storeId,
      })
      .from(orders)
      .where(inArray(orders.id, ordersToDelete));

    // Get all items for orders that need inventory release
    const openOrders = ordersToDeleteInfo.filter((o) => o.status === "open");
    if (openOrders.length > 0) {
      const openOrderIds = openOrders.map((o) => o.id);
      const allItems = await db
        .select({
          orderId: orderItems.orderId,
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
          listingId: orderItems.listingId,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, openOrderIds));

      // Get store for each listing to properly group items by store
      const listingIds = [...new Set(allItems.map((item) => item.listingId))];
      const listingsWithStores = await db
        .select({
          id: listing.id,
          storeId: listing.storeId,
        })
        .from(listing)
        .where(
          inArray(
            listing.id,
            listingIds.filter((id): id is string => id !== null)
          )
        );

      const listingStoreMap = new Map(
        listingsWithStores.map((l) => [l.id, l.storeId])
      );

      // Group items by store and order (using listing store, not order store)
      const itemsByStoreAndOrder = new Map<
        string,
        Map<string, Array<{ variantId: string | null; quantity: number }>>
      >();

      for (const item of allItems) {
        if (!item.listingId) continue;
        const itemStoreId = listingStoreMap.get(item.listingId) || null;
        if (!itemStoreId) continue;

        if (!itemsByStoreAndOrder.has(itemStoreId)) {
          itemsByStoreAndOrder.set(itemStoreId, new Map());
        }
        const orderMap = itemsByStoreAndOrder.get(itemStoreId)!;

        if (!orderMap.has(item.orderId)) {
          orderMap.set(item.orderId, []);
        }
        orderMap.get(item.orderId)!.push({
          variantId: item.variantId || null,
          quantity: item.quantity,
        });
      }

      // Release inventory for each store and order combination
      for (const [itemStoreId, orderMap] of itemsByStoreAndOrder.entries()) {
        for (const [orderId, items] of orderMap.entries()) {
          const inventoryResult = await adjustInventoryForOrder(
            items,
            itemStoreId,
            "release",
            "order_deleted",
            orderId
          );

          if (!inventoryResult.success) {
            console.error(
              `Failed to release inventory for store ${itemStoreId}, order ${orderId}:`,
              inventoryResult.error
            );
            // Continue with deletion even if inventory release fails
          }
        }
      }
    }

    // Before deleting orders, restore associated draft orders
    // Set convertedToOrderId to null and completed to false so they appear in drafts table again
    await db
      .update(draftOrders)
      .set({
        convertedToOrderId: null,
        completed: false,
        completedAt: null,
      })
      .where(inArray(draftOrders.convertedToOrderId, ordersToDelete));

    // Delete orders (cascade will handle related records)
    await db.delete(orders).where(inArray(orders.id, ordersToDelete));

    return {
      success: true,
      deletedCount: ordersToDelete.length,
    };
  } catch (error) {
    console.error("Error deleting orders:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete orders",
    };
  }
}

/**
 * Search products and variants for order creation
 */
export async function searchProductsForOrder(
  searchTerm?: string,
  searchBy:
    | "all"
    | "product_title"
    | "product_id"
    | "sku"
    | "variant_title"
    | "variant_id" = "all",
  page: number = 1,
  pageSize: number = 20,
  selectedStoreId?: string | null
): Promise<{
  success: boolean;
  data?: Array<{
    listingId: string;
    listingName: string;
    listingImageUrl: string | null;
    variantId: string;
    variantTitle: string;
    variantImageUrl: string | null;
    sku: string | null;
    price: string | null;
    currency: string | null;
    available: number;
  }>;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}> {
  try {
    const {
      storeId: userStoreId,
      isAdmin,
      error: storeError,
    } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    // Build query conditions
    // Include both "active" and "draft" listings (draft is default status)
    // Don't filter by status - show all listings that aren't archived
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof or>> = [
      or(eq(listing.status, "active"), eq(listing.status, "draft")),
    ];

    // Filter by store
    // Use provided selectedStoreId parameter if admin, otherwise use user's storeId
    const filterStoreId = selectedStoreId || (!isAdmin ? userStoreId : null);
    if (filterStoreId) {
      conditions.push(eq(listing.storeId, filterStoreId));
    }

    // Add search filter if provided
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim()}%`;

      if (searchBy === "all") {
        conditions.push(
          or(
            like(listing.name, searchPattern),
            sql`CAST(${listing.id} AS TEXT) ILIKE ${searchPattern}`,
            like(listingVariants.title, searchPattern),
            like(listingVariants.sku, searchPattern),
            sql`CAST(${listingVariants.id} AS TEXT) ILIKE ${searchPattern}`
          )
        );
      } else if (searchBy === "product_title") {
        conditions.push(like(listing.name, searchPattern));
      } else if (searchBy === "product_id") {
        conditions.push(
          sql`CAST(${listing.id} AS TEXT) ILIKE ${searchPattern}`
        );
      } else if (searchBy === "sku") {
        conditions.push(like(listingVariants.sku, searchPattern));
      } else if (searchBy === "variant_title") {
        conditions.push(like(listingVariants.title, searchPattern));
      } else if (searchBy === "variant_id") {
        conditions.push(
          sql`CAST(${listingVariants.id} AS TEXT) ILIKE ${searchPattern}`
        );
      }
    }

    // Build where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count of variants (for pagination)
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listing)
      .innerJoin(listingVariants, eq(listing.id, listingVariants.listingId))
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    // Calculate pagination
    const offset = (page - 1) * pageSize;

    // Get paginated variants (without inventory aggregation)
    const variantResults = await db
      .select({
        listingId: listing.id,
        listingName: listing.name,
        listingImageUrl: listing.imageUrl,
        variantId: listingVariants.id,
        variantTitle: listingVariants.title,
        variantImageUrl: listingVariants.imageUrl,
        sku: listingVariants.sku,
        price: listingVariants.price,
        currency: listingVariants.currency,
      })
      .from(listing)
      .innerJoin(listingVariants, eq(listing.id, listingVariants.listingId))
      .where(whereClause)
      .orderBy(listing.name, listingVariants.title)
      .limit(pageSize)
      .offset(offset);

    // Get inventory totals for all variants in one query
    const variantIds = variantResults.map((v) => v.variantId);
    const inventoryTotals =
      variantIds.length > 0
        ? await db
            .select({
              variantId: inventoryItems.variantId,
              totalAvailable:
                sql<number>`COALESCE(SUM(${inventoryLevels.available})::int, 0)`.as(
                  "total_available"
                ),
            })
            .from(inventoryItems)
            .leftJoin(
              inventoryLevels,
              eq(inventoryLevels.inventoryItemId, inventoryItems.id)
            )
            .where(inArray(inventoryItems.variantId, variantIds))
            .groupBy(inventoryItems.variantId)
        : [];

    // Create a map of variantId -> available quantity
    const inventoryMap = new Map(
      inventoryTotals.map((item) => [item.variantId, item.totalAvailable || 0])
    );

    // Combine results
    const results = variantResults.map((variant) => ({
      listingId: variant.listingId,
      listingName: variant.listingName,
      listingImageUrl: variant.listingImageUrl,
      variantId: variant.variantId,
      variantTitle: variant.variantTitle,
      variantImageUrl: variant.variantImageUrl,
      sku: variant.sku,
      price: variant.price,
      currency: variant.currency || "NPR",
      available: inventoryMap.get(variant.variantId) || 0,
    }));

    return {
      success: true,
      data: results,
      totalCount,
      page,
      pageSize,
    };
  } catch (error) {
    console.error("Error searching products:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to search products",
    };
  }
}

/**
 * Get customer shipping and billing info with priority:
 * 1. shippingBillingInfo table (user's saved/preferred address) - if customer has userId
 * 2. Most recent order (last verified address used)
 * 3. Customer/user table basic address fields as fallback
 */
export async function getCustomerShippingBillingInfo(
  customerId: string
): Promise<{
  success: boolean;
  data?: {
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    billingName: string | null;
    billingPhone: string | null;
    billingAddressLine1: string | null;
    billingAddressLine2: string | null;
    billingCity: string | null;
    billingRegion: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get customer to check if they have userId
    const customerData = await db
      .select({
        userId: customers.userId,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    const customer = customerData[0];

    // Priority 1: Get from shippingBillingInfo table (user's saved/preferred address)
    if (customer.userId) {
      const shippingBilling = await db
        .select()
        .from(shippingBillingInfo)
        .where(eq(shippingBillingInfo.userId, customer.userId))
        .limit(1);

      if (shippingBilling.length > 0) {
        const sbInfo = shippingBilling[0];
        return {
          success: true,
          data: {
            shippingName:
              sbInfo.shippingFirstName && sbInfo.shippingLastName
                ? `${sbInfo.shippingFirstName} ${sbInfo.shippingLastName}`
                : sbInfo.shippingFirstName || sbInfo.shippingLastName || null,
            shippingPhone: null, // shippingBillingInfo doesn't have phone
            shippingAddressLine1: sbInfo.shippingAddress || null,
            shippingAddressLine2: sbInfo.shippingAddress2 || null,
            shippingCity: sbInfo.shippingCity || null,
            shippingRegion: sbInfo.shippingState || null,
            shippingPostalCode: sbInfo.shippingZip || null,
            shippingCountry: sbInfo.shippingCountry || null,
            billingName:
              sbInfo.billingFirstName && sbInfo.billingLastName
                ? `${sbInfo.billingFirstName} ${sbInfo.billingLastName}`
                : sbInfo.billingFirstName || sbInfo.billingLastName || null,
            billingPhone: sbInfo.billingPhone || null,
            billingAddressLine1: sbInfo.billingAddress || null,
            billingAddressLine2: sbInfo.billingAddress2 || null,
            billingCity: sbInfo.billingCity || null,
            billingRegion: sbInfo.billingState || null,
            billingPostalCode: sbInfo.billingZip || null,
            billingCountry: sbInfo.billingCountry || null,
          },
        };
      }
    }

    // Priority 2: Get from most recent order (last verified address used)
    const recentOrder = await db
      .select({
        shippingName: orders.shippingName,
        shippingPhone: orders.shippingPhone,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingAddressLine2: orders.shippingAddressLine2,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        shippingPostalCode: orders.shippingPostalCode,
        shippingCountry: orders.shippingCountry,
        billingName: orders.billingName,
        billingPhone: orders.billingPhone,
        billingAddressLine1: orders.billingAddressLine1,
        billingAddressLine2: orders.billingAddressLine2,
        billingCity: orders.billingCity,
        billingRegion: orders.billingRegion,
        billingPostalCode: orders.billingPostalCode,
        billingCountry: orders.billingCountry,
      })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (recentOrder.length > 0) {
      const order = recentOrder[0];
      return {
        success: true,
        data: {
          shippingName: order.shippingName,
          shippingPhone: order.shippingPhone,
          shippingAddressLine1: order.shippingAddressLine1,
          shippingAddressLine2: order.shippingAddressLine2,
          shippingCity: order.shippingCity,
          shippingRegion: order.shippingRegion,
          shippingPostalCode: order.shippingPostalCode,
          shippingCountry: order.shippingCountry,
          billingName: order.billingName,
          billingPhone: order.billingPhone,
          billingAddressLine1: order.billingAddressLine1,
          billingAddressLine2: order.billingAddressLine2,
          billingCity: order.billingCity,
          billingRegion: order.billingRegion,
          billingPostalCode: order.billingPostalCode,
          billingCountry: order.billingCountry,
        },
      };
    }

    // Priority 3: Fallback to customer/user table basic address (if available)
    const fullCustomerData = await db
      .select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        addressLine1: customers.addressLine1,
        addressLine2: customers.addressLine2,
        city: customers.city,
        region: customers.region,
        postalCode: customers.postalCode,
        country: customers.country,
        userId: customers.userId,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    const customerRecord = fullCustomerData[0];
    let userRecord = null;

    if (customerRecord?.userId) {
      const userData = await db
        .select({
          name: user.name,
          address: user.address,
          city: user.city,
          country: user.country,
        })
        .from(user)
        .where(eq(user.id, customerRecord.userId))
        .limit(1);
      userRecord = userData[0] || null;
    }

    // Use customer table data, fallback to user table
    const name =
      customerRecord?.firstName && customerRecord?.lastName
        ? `${customerRecord.firstName} ${customerRecord.lastName}`
        : customerRecord?.firstName ||
          customerRecord?.lastName ||
          userRecord?.name ||
          null;
    const addressLine1 =
      customerRecord?.addressLine1 || userRecord?.address || null;
    const city = customerRecord?.city || userRecord?.city || null;
    const country = customerRecord?.country || userRecord?.country || null;

    return {
      success: true,
      data: {
        shippingName: name,
        shippingPhone: customerRecord?.phone || null,
        shippingAddressLine1: addressLine1,
        shippingAddressLine2: customerRecord?.addressLine2 || null,
        shippingCity: city,
        shippingRegion: customerRecord?.region || null,
        shippingPostalCode: customerRecord?.postalCode || null,
        shippingCountry: country,
        billingName: name,
        billingPhone: customerRecord?.phone || null,
        billingAddressLine1: addressLine1,
        billingAddressLine2: customerRecord?.addressLine2 || null,
        billingCity: city,
        billingRegion: customerRecord?.region || null,
        billingPostalCode: customerRecord?.postalCode || null,
        billingCountry: country,
      },
    };
  } catch (error) {
    console.error("Error getting customer shipping/billing info:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get customer shipping/billing info",
    };
  }
}
