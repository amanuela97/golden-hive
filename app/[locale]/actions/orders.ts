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

  user,
  shippingBillingInfo,
  orderEvents,
  orderPayments,
  orderRefunds,
  orderRefundItems,
  refundRequests,
  orderDiscounts,
  discounts,
  type Order,
  type OrderItem,
  type OrderEvent,
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
import { generateInvoiceForOrder } from "./invoice";
import {
  generateInvoiceToken,
  getInvoiceExpirationDate,
} from "@/lib/invoice-token";
import { generateOrderNumber } from "@/lib/order-number";
import { getStoreIdForUser } from "./store-id";

// List orders and archive/unarchive live in orders-list.ts and orders-archive.ts
// so the dashboard orders list page does not pull in this large file at compile time.

export type OrderRow = {
  id: string;
  orderNumber: string;
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
  fulfillmentStatus: "unfulfilled" | "partial" | "fulfilled" | "canceled";
  workflowStatus?: "normal" | "in_progress" | "on_hold";
  holdReason?: string | null;
  status: "open" | "draft" | "archived" | "canceled" | "completed";
  placedAt: Date | null;
  createdAt: Date;
  itemsCount: number;
  shippingMethod: string | null;
  archivedAt: Date | null;
  refundRequestStatus?: string | null;
  refundRequestReason?: string | null;
  storeName?: string | null;
  hasAddressWarning?: boolean;
  hasRiskWarning?: boolean;
};

export type OrderFilters = {
  search?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  status?: string;
  archived?: boolean;
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
  fulfillmentStatus?: "unfulfilled" | "partial" | "fulfilled" | "canceled";
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
    unfulfilled: ["partial", "fulfilled", "canceled"],
    partial: ["fulfilled", "canceled"],
    fulfilled: ["canceled"], // Can cancel even after fulfillment
    canceled: [], // Terminal state
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

/**
 * Find default inventory location for a store
 */
export async function getDefaultInventoryLocation(
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
  direction: "reserve" | "release" | "fulfill" | "commit" | "restock",
  reason: string,
  orderId?: string,
  skipAuth: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    let userId: string | null = null;

    if (!skipAuth) {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
      }
      userId = session.user.id;
    }

    const locationId = await getDefaultInventoryLocation(storeId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    // Map direction to event type
    const eventTypeMap: Record<
      typeof direction,
      "reserve" | "release" | "fulfill" | "adjustment" | "restock"
    > = {
      reserve: "reserve",
      release: "release",
      fulfill: "fulfill",
      commit: "adjustment", // Payment commit is an adjustment
      restock: "restock",
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
          const availableNow = level.available ?? 0;
          if (availableNow < quantity) {
            throw new Error(
              `Insufficient inventory. Available: ${availableNow}, requested: ${quantity}. Please reduce quantity or remove the item.`
            );
          }
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
            createdBy: userId,
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
            createdBy: userId,
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
          // Per inst.md: committed -= qty, onHand -= qty, available NO CHANGE
          // Items are no longer "reserved", they are now consumed/shipped
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: -quantity, // Negative because committed decreases
            reason: reason,
            eventType: eventType,
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: userId,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              committed: sql`${inventoryLevels.committed} - ${quantity}`,
              onHand: sql`${inventoryLevels.onHand} - ${quantity}`, // Physical stock leaves warehouse
              // available stays the same (was already reduced when order was created)
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
            createdBy: userId,
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
        } else if (direction === "restock") {
          // Restock: available += qty, on_hand += qty (items returned to inventory)
          // Insert ledger entry FIRST
          await tx.insert(inventoryAdjustments).values({
            inventoryItemId: invItemId,
            locationId: locationId,
            change: quantity, // Positive because available increases
            reason: reason,
            eventType: "restock",
            referenceType: referenceType,
            referenceId: orderId || null,
            createdBy: userId,
          });

          // Update snapshot SECOND
          await tx
            .update(inventoryLevels)
            .set({
              available: sql`${inventoryLevels.available} + ${quantity}`,
              onHand: sql`${inventoryLevels.available} + ${inventoryLevels.committed} + ${quantity}`, // Calculate on_hand (available increased)
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
 * Create a new order
 */
export async function createOrder(input: CreateOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}> {
  try {
    const { storeId, isAdmin, error: storeError } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    if (!isAdmin && !storeId) {
      return {
        success: false,
        error:
          "Store not found. Please set up your store first in Settings > Store.",
      };
    }

    // Check Stripe payment readiness for non-admin users
    if (!isAdmin && storeId) {
      const { getStoreSetupStatus } = await import("./store-setup");
      const { checkStripePaymentReadiness } = await import("./stripe-connect");

      const setupStatus = await getStoreSetupStatus();
      const paymentReadiness = await checkStripePaymentReadiness();

      if (!setupStatus.hasStripeAccount) {
        return {
          success: false,
          error:
            "Stripe account not connected. Please connect your Stripe account in Settings > Payments to create orders.",
        };
      }

      if (!paymentReadiness.isReady) {
        return {
          success: false,
          error:
            "Stripe onboarding incomplete. Please complete your Stripe onboarding in Settings > Payments to create orders.",
        };
      }
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

      // Generate unique order number
      const orderNumber = await generateOrderNumber();

      const newOrder = await tx
        .insert(orders)
        .values({
          orderNumber: orderNumber,
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
      const returnedOrderNumber = newOrder[0].orderNumber;

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

      // Create chat room for this order
      try {
        // Get buyer ID (customer's userId if linked, otherwise logged-in user)
        let buyerId: string | null = userId; // Use the logged-in user ID

        // If we have a customerId, try to get userId from customer record
        if (customerId) {
          const [customer] = await db
            .select({ userId: customers.userId })
            .from(customers)
            .where(eq(customers.id, customerId))
            .limit(1);
          buyerId = customer?.userId || buyerId;
        }

        // Only create chat room if we have a buyerId and storeId
        if (buyerId && finalStoreId) {
          const { ensureChatRoomExists } = await import(
            "@/app/[locale]/actions/chat"
          );
          await ensureChatRoomExists(orderId, finalStoreId, buyerId);
        }
      } catch (chatError) {
        // Log error but don't fail order creation
        console.error("Error creating chat room:", chatError);
      }

      return {
        success: true,
        orderId,
        orderNumber: returnedOrderNumber,
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

        // Get fulfillment status to determine if order should be completed
        const orderFulfillment = await tx
          .select({ fulfillmentStatus: orders.fulfillmentStatus })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        const fulfillmentStatus = orderFulfillment[0]?.fulfillmentStatus;
        const isFulfilled =
          fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partial";

        // Determine order status:
        // - If paid and fulfilled → "completed"
        // - Otherwise keep current status
        const currentOrderData = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        const currentStatus =
          currentOrderData.length > 0 ? currentOrderData[0].status : "open";
        let newOrderStatus = currentStatus;

        if (isFulfilled && newStatus === "paid") {
          newOrderStatus = "completed";
          console.log(
            `[Payment] Order ${orderId} is paid and fulfilled, setting status to completed`
          );
        }

        // Update order
        await tx
          .update(orders)
          .set({
            paymentStatus: newStatus,
            paidAt: new Date(),
            status: newOrderStatus,
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
  newStatus: "unfulfilled" | "partial" | "fulfilled" | "canceled"
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
      // Capture payment when fulfillment starts (if payment is still pending)
      // This minimizes platform loss by capturing only when seller confirms order
      if (
        paymentStatus === "pending" &&
        (newStatus === "partial" || newStatus === "fulfilled")
      ) {
        // Get payment intent ID
        const paymentData = await tx
          .select({
            id: orderPayments.id,
            stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          })
          .from(orderPayments)
          .where(eq(orderPayments.orderId, orderId))
          .limit(1);

        if (paymentData.length > 0 && paymentData[0].stripePaymentIntentId) {
          try {
            const { stripe } = await import("@/lib/stripe");
            const paymentIntent = await stripe.paymentIntents.retrieve(
              paymentData[0].stripePaymentIntentId
            );

            // Only capture if payment is still in requires_capture status
            if (paymentIntent.status === "requires_capture") {
              // Capture payment
              let capturedPaymentIntent;
              try {
                capturedPaymentIntent = await stripe.paymentIntents.capture(
                  paymentData[0].stripePaymentIntentId
                );
                console.log("✅ Payment Captured During Fulfillment:", {
                  paymentIntentId: capturedPaymentIntent.id,
                  status: capturedPaymentIntent.status,
                  amount: capturedPaymentIntent.amount,
                  amount_received: capturedPaymentIntent.amount_received,
                });

                // Verify capture succeeded
                if (capturedPaymentIntent.status !== "succeeded") {
                  console.warn(
                    "⚠️ Payment Intent not succeeded after capture:",
                    {
                      paymentIntentId: capturedPaymentIntent.id,
                      status: capturedPaymentIntent.status,
                    }
                  );
                  throw new Error(
                    `Payment capture completed but status is ${capturedPaymentIntent.status}, not succeeded`
                  );
                }
              } catch (captureError) {
                console.error(
                  "❌ Error capturing payment during fulfillment:",
                  captureError
                );
                // Don't fail fulfillment if capture fails - can be retried
                throw captureError;
              }

              // Update payment status to completed
              await tx
                .update(orderPayments)
                .set({
                  status: "completed",
                  updatedAt: new Date(),
                })
                .where(eq(orderPayments.id, paymentData[0].id));

              // Update order payment status to paid
              await tx
                .update(orders)
                .set({
                  paymentStatus: "paid",
                  paidAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(orders.id, orderId));

              // Update seller balance now that payment is captured
              // Import here to avoid circular dependency issues
              const { updateSellerBalance } = await import("./seller-balance");

              // Get payment details for balance update
              const paymentDetails = await tx
                .select({
                  amount: orderPayments.amount,
                  currency: orderPayments.currency,
                  platformFeeAmount: orderPayments.platformFeeAmount,
                })
                .from(orderPayments)
                .where(eq(orderPayments.id, paymentData[0].id))
                .limit(1);

              if (paymentDetails.length > 0) {
                const payment = paymentDetails[0];
                const totalAmount = parseFloat(payment.amount);
                const platformFee = parseFloat(
                  payment.platformFeeAmount || "0"
                );

                // Calculate Stripe fee (2.9% + €0.30)
                const stripeFeeRate = 0.029;
                const stripeFeeFixed = 0.3;
                const stripeFee = totalAmount * stripeFeeRate + stripeFeeFixed;

                // Get order store ID
                const orderInfo = await tx
                  .select({ storeId: orders.storeId })
                  .from(orders)
                  .where(eq(orders.id, orderId))
                  .limit(1);

                if (orderInfo.length > 0 && orderInfo[0].storeId) {
                  // Update seller balance with captured payment
                  // 1. Order payment (CREDIT)
                  await updateSellerBalance({
                    storeId: orderInfo[0].storeId,
                    type: "order_payment",
                    amount: totalAmount,
                    currency: payment.currency,
                    orderId: orderId,
                    orderPaymentId: paymentData[0].id,
                    description: `Order payment captured`,
                  });

                  // 2. Platform fee (DEBIT)
                  await updateSellerBalance({
                    storeId: orderInfo[0].storeId,
                    type: "platform_fee",
                    amount: platformFee,
                    currency: payment.currency,
                    orderId: orderId,
                    orderPaymentId: paymentData[0].id,
                    description: `Platform fee (5%) for order`,
                  });

                  // 3. Stripe fee (DEBIT)
                  await updateSellerBalance({
                    storeId: orderInfo[0].storeId,
                    type: "stripe_fee",
                    amount: stripeFee,
                    currency: payment.currency,
                    orderId: orderId,
                    orderPaymentId: paymentData[0].id,
                    description: `Stripe processing fee for order`,
                  });
                }
              }
            }
          } catch (captureError) {
            console.error(
              "Error capturing payment during fulfillment:",
              captureError
            );
            // Don't fail fulfillment if capture fails - can be retried
          }
        }
      }

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
      } else {
        // Other transitions
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
type OrderWithItems = Order & {
  items: Array<
    Pick<
      OrderItem,
      | "id"
      | "listingId"
      | "title"
      | "sku"
      | "quantity"
      | "fulfilledQuantity"
      | "unitPrice"
      | "lineSubtotal"
      | "lineTotal"
      | "currency"
    > & {
      imageUrl: string | null;
      listingSlug: string | null;
      refundableQuantity: number; // Remaining quantity that can be refunded
    }
  >;
  events: Array<
    Pick<
      OrderEvent,
      | "id"
      | "type"
      | "visibility"
      | "message"
      | "metadata"
      | "createdBy"
      | "createdAt"
    >
  >;
  paymentProvider: string | null; // 'stripe' | 'manual' | null
  discount?: {
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    amount: number;
    currency: string;
  } | null;
};

export async function getOrderWithItems(orderId: string): Promise<{
  success: boolean;
  data?: OrderWithItems;
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

    // Get order with all fields - use selectAll to get all Order fields
    const orderData = await db
      .select()
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
        listingId: orderItems.listingId,
        title: orderItems.title,
        sku: orderItems.sku,
        quantity: orderItems.quantity,
        fulfilledQuantity: orderItems.fulfilledQuantity,
        unitPrice: orderItems.unitPrice,
        lineSubtotal: orderItems.lineSubtotal,
        lineTotal: orderItems.lineTotal,
        currency: orderItems.currency,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
        listingSlug: listing.slug,
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

    // Get all succeeded refund records for this order to calculate remaining refundable quantities
    const refundItems = await db
      .select({
        orderItemId: orderRefundItems.orderItemId,
        quantity: orderRefundItems.quantity,
      })
      .from(orderRefundItems)
      .innerJoin(orderRefunds, eq(orderRefundItems.refundId, orderRefunds.id))
      .where(
        and(
          eq(orderRefunds.orderId, orderId),
          eq(orderRefunds.status, "succeeded")
        )
      );

    // Calculate refunded quantities per item
    const refundedQuantities = new Map<string, number>();
    for (const refundItem of refundItems) {
      const current = refundedQuantities.get(refundItem.orderItemId) || 0;
      refundedQuantities.set(
        refundItem.orderItemId,
        current + refundItem.quantity
      );
    }

    // Get payment provider from the first completed payment
    const paymentData = await db
      .select({
        provider: orderPayments.provider,
      })
      .from(orderPayments)
      .where(
        and(
          eq(orderPayments.orderId, orderId),
          eq(orderPayments.status, "completed")
        )
      )
      .orderBy(asc(orderPayments.createdAt))
      .limit(1);

    const paymentProvider =
      paymentData.length > 0 ? paymentData[0].provider : null;

    // Get order discount information with name from discounts table
    const discountData = await db
      .select({
        code: orderDiscounts.code,
        valueType: orderDiscounts.valueType,
        value: orderDiscounts.value,
        amount: orderDiscounts.amount,
        currency: orderDiscounts.currency,
        discountId: orderDiscounts.discountId,
        discountName: discounts.name,
      })
      .from(orderDiscounts)
      .leftJoin(discounts, eq(orderDiscounts.discountId, discounts.id))
      .where(eq(orderDiscounts.orderId, orderId))
      .limit(1);

    const discount =
      discountData.length > 0
        ? {
            name: discountData[0].discountName || "Custom discount",
            code: discountData[0].code,
            valueType: discountData[0].valueType as "fixed" | "percentage",
            value: parseFloat(discountData[0].value),
            amount: parseFloat(discountData[0].amount),
            currency: discountData[0].currency,
          }
        : null;

    // Get fulfillment info (for shipping labels)
    const { fulfillments } = await import("@/db/schema");
    const fulfillmentData = await db
      .select({
        trackingNumber: fulfillments.trackingNumber,
        carrier: fulfillments.carrier,
        labelUrl: fulfillments.labelUrl,
        labelFileType: fulfillments.labelFileType,
      })
      .from(fulfillments)
      .where(
        and(
          eq(fulfillments.orderId, orderId),
          ...(!isAdmin && storeId ? [eq(fulfillments.storeId, storeId)] : [])
        )
      )
      .limit(1);

    const fulfillmentInfo =
      fulfillmentData.length > 0
        ? {
            trackingNumber: fulfillmentData[0].trackingNumber,
            carrier: fulfillmentData[0].carrier,
            labelUrl: fulfillmentData[0].labelUrl,
            labelFileType: fulfillmentData[0].labelFileType,
          }
        : {
            trackingNumber: null,
            carrier: null,
            labelUrl: null,
            labelFileType: null,
          };

    // Get refund request details if exists (for rejection reason)
    const refundRequestData = await db
      .select({
        id: refundRequests.id,
        status: refundRequests.status,
        rejectionReason: refundRequests.rejectionReason,
        reviewedAt: refundRequests.reviewedAt,
      })
      .from(refundRequests)
      .where(eq(refundRequests.orderId, orderId))
      .orderBy(desc(refundRequests.createdAt))
      .limit(1);

    const refundRequestInfo =
      refundRequestData.length > 0
        ? {
            id: refundRequestData[0].id,
            status: refundRequestData[0].status,
            rejectionReason: refundRequestData[0].rejectionReason,
            reviewedAt: refundRequestData[0].reviewedAt,
          }
        : null;

    return {
      success: true,
      data: {
        ...order,
        refundRequestedAt: refundRequestInfo?.reviewedAt || null,
        refundRequestStatus: refundRequestInfo?.status || null,
        refundRequestReason: refundRequestInfo?.rejectionReason || null,
        items: items.map((item) => {
          const refundedQty = refundedQuantities.get(item.id) || 0;
          const refundableQty = Math.max(0, item.quantity - refundedQty);
          return {
            id: item.id,
            listingId: item.listingId,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            fulfilledQuantity: item.fulfilledQuantity || 0,
            unitPrice: item.unitPrice,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            currency: item.currency,
            imageUrl: item.variantImageUrl || item.listingImageUrl || null,
            listingSlug: item.listingSlug,
            refundableQuantity: refundableQty,
          };
        }),
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          visibility: event.visibility,
          message: event.message,
          metadata: event.metadata as Record<string, unknown> | null,
          createdBy: event.createdBy,
          createdAt: event.createdAt,
        })),
        paymentProvider,
        discount,
        ...fulfillmentInfo,
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
 * Cancel an order with form data
 */
export async function cancelOrder(input: {
  orderId: string;
  refundMethod: "original" | "later";
  cancellationReason: string;
  internalNote?: string | null;
  restock: boolean;
  sendNotification: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get order data
    const orderData = await db
      .select({
        id: orders.id,
        status: orders.status,
        storeId: orders.storeId,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        orderNumber: orders.orderNumber,
        internalNote: orders.internalNote,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions
    if (!isAdmin && storeId && order.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to cancel this order",
      };
    }

    // Validate order can be canceled
    if (order.status === "canceled") {
      return { success: false, error: "Order is already canceled" };
    }

    if (order.status === "archived") {
      return {
        success: false,
        error: "Cannot cancel archived order. Please unarchive it first.",
      };
    }

    // Get order items for inventory restocking
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    // Get payment information for refund processing
    const paymentData = await db
      .select({
        id: orderPayments.id,
        amount: orderPayments.amount,
        currency: orderPayments.currency,
        provider: orderPayments.provider,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        stripeCheckoutSessionId: orderPayments.stripeCheckoutSessionId,
        status: orderPayments.status,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, input.orderId));

    await db.transaction(async (tx) => {
      // Restock inventory if requested and order is unfulfilled
      if (
        input.restock &&
        order.fulfillmentStatus === "unfulfilled" &&
        order.storeId
      ) {
        const inventoryResult = await adjustInventoryForOrder(
          items.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          order.storeId,
          "release",
          "order_canceled",
          input.orderId
        );

        if (!inventoryResult.success) {
          throw new Error(
            inventoryResult.error || "Failed to restock inventory"
          );
        }
      }

      // Handle refunds if payment was made and refund method is "original"
      let newPaymentStatus = order.paymentStatus;
      if (
        input.refundMethod === "original" &&
        order.paymentStatus === "paid" &&
        paymentData.length > 0
      ) {
        // TODO: Implement Stripe refund processing
        // 1. For each payment in paymentData:
        //    - If provider === "stripe" and stripePaymentIntentId exists:
        //      a. Call Stripe API to create refund: stripe.refunds.create({ payment_intent: stripePaymentIntentId, amount: amount })
        //      b. Create refund record in orderPayments table with:
        //         - orderId: input.orderId
        //         - amount: negative amount (or positive with type="refund")
        //         - provider: "stripe"
        //         - providerPaymentId: refund.id from Stripe
        //         - status: "completed"
        //      c. Update original payment status if needed
        //    - If provider === "manual":
        //      a. Just create refund record (no Stripe API call)
        // 2. Update order paymentStatus:
        //    - If full refund: paymentStatus = "refunded"
        //    - If partial refund: paymentStatus = "partially_refunded"
        // 3. Add timeline event for refund

        // Calculate total paid amount
        const totalPaid = paymentData
          .filter((p) => p.status === "completed")
          .reduce((sum, p) => sum + parseFloat(p.amount), 0);

        // For now, just update payment status to "refunded" (will be implemented with Stripe)
        // TODO: When Stripe refund is implemented, check if refund is full or partial
        newPaymentStatus = "refunded";

        // Create refund record placeholder (will be replaced with actual Stripe refund)
        // Note: Store refund amount as positive, the negative will be handled in calculations
        for (const payment of paymentData) {
          if (payment.status === "completed") {
            const refundAmount = parseFloat(payment.amount);
            await tx.insert(orderPayments).values({
              orderId: input.orderId,
              amount: refundAmount.toString(), // Store as positive, mark as refund in providerPaymentId or metadata
              currency: payment.currency,
              provider: payment.provider || "manual",
              providerPaymentId: null, // TODO: Set to Stripe refund ID when implemented (e.g., "refund_re_xxx")
              status: "completed",
              // TODO: When implementing Stripe refunds:
              // - Call stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: refundAmount * 100 })
              // - Set providerPaymentId to refund.id
              // - Handle platform fee refunds if applicable
            });
          }
        }

        // Add timeline event for refund
        await tx.insert(orderEvents).values({
          orderId: input.orderId,
          type: "payment",
          visibility: "internal",
          message: `Refund processed${input.refundMethod === "original" ? " via original payment method" : ""}`,
          createdBy: userId,
          metadata: {
            refundMethod: input.refundMethod,
            totalRefunded: totalPaid.toString(),
            currency: order.currency,
            // TODO: Add Stripe refund IDs when implemented
          } as Record<string, unknown>,
        });
      }

      // Update order status and internal note
      const updatedInternalNote = input.internalNote
        ? order.internalNote
          ? `${order.internalNote}\n\n[Canceled] ${input.internalNote}`
          : `[Canceled] ${input.internalNote}`
        : order.internalNote;

      await tx
        .update(orders)
        .set({
          status: "canceled",
          canceledAt: new Date(),
          paymentStatus: newPaymentStatus,
          internalNote: updatedInternalNote,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // Create timeline event
      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "system",
        visibility: "internal",
        message: `Order canceled. Reason: ${input.cancellationReason}`,
        createdBy: userId,
        metadata: {
          refundMethod: input.refundMethod,
          cancellationReason: input.cancellationReason,
          restocked: input.restock,
          notificationSent: input.sendNotification,
        } as Record<string, unknown>,
      });
    });

    // Note: Invoice generation is NOT performed during cancellation
    // Invoices should only be generated:
    // 1. When order is fulfilled/completed (for accounting purposes)
    // 2. When explicitly requested by admin
    // 3. Not during cancellation (following Shopify's pattern)

    // Send cancellation email (if requested)
    if (input.sendNotification && order.customerEmail) {
      try {
        const resend = (await import("@/lib/resend")).default;
        const OrderCancellationEmail = (
          await import("@/app/[locale]/components/order-cancellation-email")
        ).default;

        const customerName =
          order.customerFirstName && order.customerLastName
            ? `${order.customerFirstName} ${order.customerLastName}`
            : order.customerEmail || "Customer";

        await resend.emails.send({
          from: "Golden Market <goldenmarket@resend.dev>",
          to: order.customerEmail!,
          subject: `Order #${order.orderNumber} Cancellation`,
          react: OrderCancellationEmail({
            orderNumber: order.orderNumber,
            customerName,
            customerEmail: order.customerEmail!,
            cancellationReason: input.cancellationReason,
            total: order.totalAmount,
            currency: order.currency,
          }),
        });
        console.log("Cancellation email sent successfully");
      } catch (emailError) {
        // Log error but don't fail the cancellation
        console.error("Failed to send cancellation email:", emailError);
        // Don't throw - email failure shouldn't fail cancellation
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error canceling order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
    };
  }
}

/**
 * Get store owner email (admin member of the store)
 */
export async function getStoreOwnerEmail(storeId: string): Promise<{
  success: boolean;
  email?: string | null;
  error?: string;
}> {
  try {
    const ownerData = await db
      .select({
        email: user.email,
      })
      .from(storeMembers)
      .innerJoin(user, eq(storeMembers.userId, user.id))
      .where(eq(storeMembers.storeId, storeId))
      .limit(1);

    if (ownerData.length === 0) {
      return { success: false, error: "Store owner not found" };
    }

    return { success: true, email: ownerData[0].email };
  } catch (error) {
    console.error("Error getting store owner email:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get store owner email",
    };
  }
}

/**
 * Get store owner email from a listing ID
 */
export async function getStoreOwnerEmailFromListing(
  listingId: string
): Promise<{
  success: boolean;
  email?: string | null;
  error?: string;
}> {
  try {
    // Get storeId from listing
    const listingData = await db
      .select({
        storeId: listing.storeId,
      })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (listingData.length === 0) {
      return { success: false, error: "Listing not found" };
    }

    const storeId = listingData[0].storeId;
    if (!storeId) {
      return { success: false, error: "Listing has no associated store" };
    }

    // Use the existing getStoreOwnerEmail function
    return await getStoreOwnerEmail(storeId);
  } catch (error) {
    console.error("Error getting store owner email from listing:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get store owner email from listing",
    };
  }
}

/**
 * Send invoice for an order
 * Follows the steps from inst.md:
 * 1. Validate order state
 * 2. Lock financial snapshot (if requested)
 * 3. Generate invoice number
 * 4. Generate invoice document (PDF)
 * 5. Create payment session / link
 * 6. Send invoice email
 * 7. Update order state
 * 8. Timeline / audit log entry
 */
export async function sendInvoiceForOrder(input: {
  orderId: string;
  fromEmail: string;
  toEmail: string;
  customMessage?: string | null;
  lockPrices: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get order with all necessary data
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        storeId: orders.storeId,
        paymentStatus: orders.paymentStatus,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        invoiceNumber: orders.invoiceNumber,
        invoiceLockedAt: orders.invoiceLockedAt,
        invoicePdfUrl: orders.invoicePdfUrl,
        invoiceToken: orders.invoiceToken,
        invoiceExpiresAt: orders.invoiceExpiresAt,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions
    if (!isAdmin && storeId && order.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to send invoice for this order",
      };
    }

    // Step 1: Validate order state (gatekeeping)
    if (order.status === "canceled") {
      return {
        success: false,
        error: "Cannot send invoice for canceled order",
      };
    }

    if (order.status === "archived") {
      return {
        success: false,
        error:
          "Cannot send invoice for archived order. Please unarchive it first.",
      };
    }

    // Check if order is fully paid
    const isFullyPaid =
      order.paymentStatus === "paid" ||
      order.paymentStatus === "partially_refunded";
    if (isFullyPaid) {
      return {
        success: false,
        error: "Cannot send invoice for fully paid order",
      };
    }

    if (!order.customerEmail) {
      return { success: false, error: "Order has no customer email" };
    }

    // Check if order has items
    const itemsCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    if (!itemsCount[0] || itemsCount[0].count === 0) {
      return { success: false, error: "Order has no items" };
    }

    // Step 2: Lock financials if requested
    if (input.lockPrices && !order.invoiceLockedAt) {
      await db
        .update(orders)
        .set({
          invoiceLockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));
    }

    // Step 3 & 4: Generate invoice number and PDF if not already generated
    let invoiceNumber = order.invoiceNumber;
    let invoicePdfUrl = order.invoicePdfUrl;

    if (!invoiceNumber || !invoicePdfUrl) {
      const invoiceResult = await generateInvoiceForOrder(input.orderId);
      if (!invoiceResult.success) {
        return {
          success: false,
          error: invoiceResult.error || "Failed to generate invoice",
        };
      }
      invoiceNumber = invoiceResult.invoiceNumber || null;
      invoicePdfUrl = invoiceResult.invoicePdfUrl || null;
    }

    // Step 5: Create payment link (generate token for invoice payment)
    // Reuse existing token if valid, otherwise generate new one
    let invoiceToken = order.invoiceToken;
    let expiresAt = order.invoiceExpiresAt;

    if (!invoiceToken || !expiresAt || new Date(expiresAt) < new Date()) {
      invoiceToken = generateInvoiceToken();
      expiresAt = getInvoiceExpirationDate(30); // 30 days
    }

    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceToken}`;

    // Step 6: Send invoice email
    const resend = (await import("@/lib/resend")).default;
    const OrderInvoiceEmail = (
      await import("@/app/[locale]/components/order-invoice-email")
    ).default;

    const customerName =
      order.customerFirstName && order.customerLastName
        ? `${order.customerFirstName} ${order.customerLastName}`
        : order.customerEmail || "Customer";

    const emailResult = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        "Golden Market <goldenmarket@resend.dev>",
      to: input.toEmail,
      subject: `Invoice ${invoiceNumber || `#${order.orderNumber}`} - Payment Required`,
      react: OrderInvoiceEmail({
        invoiceNumber: invoiceNumber || "",
        orderNumber: order.orderNumber,
        customerName,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentUrl,
        customMessage: input.customMessage,
        invoicePdfUrl: invoicePdfUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      }),
    });

    if (emailResult.error) {
      return {
        success: false,
        error: `Failed to send email: ${emailResult.error.message}`,
      };
    }

    // Step 7: Update order state
    await db
      .update(orders)
      .set({
        invoiceToken,
        invoiceExpiresAt: expiresAt,
        invoiceSentAt: new Date(),
        invoiceSentCount: sql`COALESCE(${orders.invoiceSentCount}, 0) + 1`,
        paymentStatus: "pending", // Ensure payment status is pending
        updatedAt: new Date(),
      })
      .where(eq(orders.id, input.orderId));

    // Step 8: Create timeline event
    await db.insert(orderEvents).values({
      orderId: input.orderId,
      type: "invoice_sent",
      visibility: "public",
      message: `Invoice ${invoiceNumber || `#${order.orderNumber}`} was sent to ${input.toEmail}`,
      metadata: {
        invoiceNumber,
        toEmail: input.toEmail,
        fromEmail: input.fromEmail,
        lockPrices: input.lockPrices,
      },
      createdBy: userId,
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invoice",
    };
  }
}

/**
 * Send invoice PDF for an order
 */
export async function sendInvoicePdfForOrder(input: {
  orderId: string;
  fromEmail: string;
  toEmail: string;
  customMessage?: string | null;
  lockPrices: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get order with invoice details
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        storeId: orders.storeId,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        invoiceNumber: orders.invoiceNumber,
        invoicePdfUrl: orders.invoicePdfUrl,
        invoicePublicId: orders.invoicePublicId,
        invoiceLockedAt: orders.invoiceLockedAt,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions
    if (!isAdmin && storeId && order.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to send invoice PDF for this order",
      };
    }

    // Validate order state
    if (order.status === "canceled") {
      return {
        success: false,
        error: "Cannot send invoice PDF for canceled order",
      };
    }

    if (order.status === "archived") {
      return {
        success: false,
        error:
          "Cannot send invoice PDF for archived order. Please unarchive it first.",
      };
    }

    if (!order.customerEmail) {
      return {
        success: false,
        error: "Order has no customer email address",
      };
    }

    // Step 2: Lock financials if requested
    if (input.lockPrices && !order.invoiceLockedAt) {
      await db
        .update(orders)
        .set({
          invoiceLockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));
    }

    // Ensure invoice PDF exists
    let invoiceNumber = order.invoiceNumber;
    let invoicePdfUrl = order.invoicePdfUrl;
    let invoicePublicId = order.invoicePublicId;

    if (!invoiceNumber || !invoicePdfUrl || !invoicePublicId) {
      // Generate invoice if it doesn't exist
      const invoiceResult = await generateInvoiceForOrder(input.orderId);
      if (!invoiceResult.success) {
        return {
          success: false,
          error: invoiceResult.error || "Failed to generate invoice PDF",
        };
      }
      invoiceNumber = invoiceResult.invoiceNumber || null;
      invoicePdfUrl = invoiceResult.invoicePdfUrl || null;
      invoicePublicId = invoiceResult.invoicePublicId || null;
    }

    if (!invoicePublicId) {
      return {
        success: false,
        error: "Invoice PDF not found. Please generate the invoice first.",
      };
    }

    // Send email with the signed URL
    const resend = (await import("@/lib/resend")).default;
    const OrderInvoicePdfEmail = (
      await import("@/app/[locale]/components/order-invoice-pdf-email")
    ).default;

    const customerName =
      order.customerFirstName && order.customerLastName
        ? `${order.customerFirstName} ${order.customerLastName}`
        : order.customerEmail || "Customer";

    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      "Golden Market <goldenmarket@resend.dev>";

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: input.toEmail,
      replyTo:
        input.fromEmail && input.fromEmail.includes("@")
          ? input.fromEmail
          : undefined,
      subject: `Invoice ${invoiceNumber || `#${order.orderNumber}`} - ${order.customerEmail}`,
      react: OrderInvoicePdfEmail({
        invoiceNumber: invoiceNumber || `#${order.orderNumber}`,
        orderNumber: order.orderNumber,
        customerName,
        totalAmount: order.totalAmount,
        currency: order.currency,
        customMessage: input.customMessage,
        invoicePdfUrl: invoicePdfUrl,
      }),
    });

    if (emailResult.error) {
      return {
        success: false,
        error: `Failed to send email: ${emailResult.error.message}`,
      };
    }

    // Log timeline event
    await db.insert(orderEvents).values({
      orderId: input.orderId,
      type: "email",
      visibility: "internal",
      message: `Invoice PDF sent to ${input.toEmail}`,
      metadata: {
        invoiceNumber,
        toEmail: input.toEmail,
        fromEmail: input.fromEmail,
      },
      createdBy: userId,
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending invoice PDF:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send invoice PDF",
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

/**
 * Recalculate order payment status from payments and refunds (derived values)
 * This ensures orders.refundedAmount and orders.paymentStatus are always accurate
 */
export async function recalculateOrderPaymentStatus(
  orderId: string,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<void> {
  const dbInstance = tx || db;

  // Get all payments for this order (completed, partially_refunded, or refunded)
  // We need to include partially_refunded and refunded payments because they were originally completed
  const payments = await dbInstance
    .select({
      amount: orderPayments.amount,
      refundedAmount: orderPayments.refundedAmount,
    })
    .from(orderPayments)
    .where(
      and(
        eq(orderPayments.orderId, orderId),
        or(
          eq(orderPayments.status, "completed"),
          eq(orderPayments.status, "partially_refunded"),
          eq(orderPayments.status, "refunded")
        )
      )
    );

  // Calculate totals
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalRefunded = payments.reduce(
    (sum, p) => sum + parseFloat(p.refundedAmount || "0"),
    0
  );

  console.log(`[Refund] Recalculating payment status:`, {
    orderId,
    totalPaid,
    totalRefunded,
    payments: payments.map((p) => ({
      amount: p.amount,
      refundedAmount: p.refundedAmount,
    })),
  });

  // Determine payment status
  let paymentStatus: "paid" | "partially_refunded" | "refunded";
  if (totalRefunded >= totalPaid - 0.01) {
    // Allow small floating point differences
    paymentStatus = "refunded";
  } else if (totalRefunded > 0) {
    paymentStatus = "partially_refunded";
  } else {
    paymentStatus = "paid";
  }

  console.log(`[Refund] Calculated payment status:`, {
    orderId,
    paymentStatus,
    totalPaid,
    totalRefunded,
  });

  // Update order (only if we have a transaction context)
  if (tx) {
    // Get order fulfillment status to determine if we should cancel
    const orderData = await tx
      .select({
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length > 0) {
      const fulfillmentStatus = orderData[0].fulfillmentStatus;
      const currentStatus = orderData[0].status;

      // Determine order status based on refund and fulfillment rules:
      // - Unfulfilled + Fully Refunded → canceled
      // - Unfulfilled + Partially Refunded → open (keep as is)
      // - Fulfilled orders: Keep status as "open" (or current status), NEVER change to canceled
      //   (Fulfillment is historical fact - refunding doesn't un-fulfill)
      let newOrderStatus = currentStatus;

      const isFulfilled =
        fulfillmentStatus === "fulfilled" || fulfillmentStatus === "partial";

      if (isFulfilled) {
        // Fulfilled orders: Set to "completed" (per inst.md)
        // Refunding a fulfilled order doesn't un-fulfill it
        // Per inst.md: fulfilled + refunded = completed (not canceled, not open)
        newOrderStatus = "completed";
        console.log(
          `[Refund] Order ${orderId} is fulfilled (${fulfillmentStatus}), setting status to completed (refund does not un-fulfill)`
        );
      } else if (
        (fulfillmentStatus === "unfulfilled" || fulfillmentStatus === null) &&
        paymentStatus === "refunded"
      ) {
        // Unfulfilled + fully refunded = canceled
        newOrderStatus = "canceled";
        console.log(
          `[Refund] Order ${orderId} is unfulfilled and fully refunded, setting status to canceled`
        );
      } else if (
        (fulfillmentStatus === "unfulfilled" || fulfillmentStatus === null) &&
        paymentStatus === "partially_refunded"
      ) {
        // Unfulfilled + partially refunded = open (keep as is)
        newOrderStatus = "open";
        console.log(
          `[Refund] Order ${orderId} is unfulfilled and partially refunded, keeping status as open`
        );
      }

      await tx
        .update(orders)
        .set({
          refundedAmount: totalRefunded.toString(),
          paymentStatus,
          status: newOrderStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }
  }
}

/**
 * Process refund for an order (improved architecture per inst.md)
 */
export async function processRefund(input: {
  orderId: string;
  refundType: "full" | "partial";
  amount?: string; // Required for partial refunds
  restockItems: boolean;
  reason?: string;
  refundedItems?: Array<{ orderItemId: string; quantity: number }>; // Item-level refund quantities
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Step 1 & 2: Validate refund request
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        storeId: orders.storeId,
        totalAmount: orders.totalAmount,
        refundedAmount: orders.refundedAmount,
        currency: orders.currency,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        invoiceNumber: orders.invoiceNumber,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Precondition checks
    if (
      order.paymentStatus !== "paid" &&
      order.paymentStatus !== "partially_refunded"
    ) {
      return {
        success: false,
        error: "Order must be paid or partially refunded to process a refund",
      };
    }

    if (order.status === "draft") {
      return { success: false, error: "Draft orders cannot be refunded" };
    }

    // Note: Fulfilled orders CAN be refunded
    // Refunding does NOT un-fulfill the order (fulfillment is historical fact)
    // The fulfillment status will remain unchanged

    const totalPaid = parseFloat(order.totalAmount);
    const alreadyRefunded = parseFloat(order.refundedAmount || "0");
    const maxRefundable = totalPaid - alreadyRefunded;

    // Always use the provided amount if available (from selected items)
    // Only use maxRefundable if no amount is provided and it's a full refund
    let refundAmount: number;
    if (input.amount) {
      // Use the calculated amount from selected items
      refundAmount = parseFloat(input.amount);
      if (isNaN(refundAmount) || refundAmount <= 0) {
        return { success: false, error: "Invalid refund amount" };
      }
      if (refundAmount > maxRefundable) {
        return {
          success: false,
          error: `Refund amount cannot exceed ${maxRefundable.toFixed(2)} ${order.currency}`,
        };
      }
    } else if (input.refundType === "full") {
      // Only use maxRefundable if no amount provided and it's explicitly a full refund
      refundAmount = maxRefundable;
    } else {
      return {
        success: false,
        error: "Refund amount is required for partial refunds",
      };
    }

    // Get order items for inventory adjustment
    const orderItemsData = await db
      .select({
        id: orderItems.id,
        variantId: orderItems.variantId,
        listingId: orderItems.listingId,
        quantity: orderItems.quantity,
        title: orderItems.title,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    if (orderItemsData.length === 0) {
      return { success: false, error: "Order has no items" };
    }

    // Get payment information - include completed, partially_refunded, and refunded payments
    // (refunded payments are included to check if they still have refundable amount)
    const paymentData = await db
      .select({
        id: orderPayments.id,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        stripeCheckoutSessionId: orderPayments.stripeCheckoutSessionId,
        provider: orderPayments.provider,
        providerPaymentId: orderPayments.providerPaymentId,
        amount: orderPayments.amount,
        refundedAmount: orderPayments.refundedAmount,
        status: orderPayments.status,
        platformFeeAmount: orderPayments.platformFeeAmount,
        netAmountToStore: orderPayments.netAmountToStore,
      })
      .from(orderPayments)
      .where(
        and(
          eq(orderPayments.orderId, input.orderId),
          or(
            eq(orderPayments.status, "completed"),
            eq(orderPayments.status, "partially_refunded"),
            eq(orderPayments.status, "refunded")
          )
        )
      );

    // Calculate refundable payments (amount - refundedAmount)
    const refundablePayments = paymentData
      .map((p) => ({
        ...p,
        refundable: parseFloat(p.amount) - parseFloat(p.refundedAmount || "0"),
      }))
      .filter((p) => p.refundable > 0);

    if (refundablePayments.length === 0) {
      return {
        success: false,
        error: "No refundable payments found for this order",
      };
    }

    // Calculate total refundable amount
    const totalRefundable = refundablePayments.reduce(
      (sum, p) => sum + p.refundable,
      0
    );

    // Validate refund amount against refundable payments
    if (refundAmount > totalRefundable) {
      return {
        success: false,
        error: `Refund amount cannot exceed ${totalRefundable.toFixed(2)} ${order.currency} (total refundable from payments)`,
      };
    }

    // Get store Stripe account ID if needed
    let storeStripeAccountId: string | null = null;
    if (order.storeId) {
      const storeData = await db
        .select({
          stripeAccountId: store.stripeAccountId,
        })
        .from(store)
        .where(eq(store.id, order.storeId))
        .limit(1);

      if (storeData.length > 0) {
        storeStripeAccountId = storeData[0].stripeAccountId;
      }
    }

    // Step 3: Split refund across payments (Stripe-first)
    // Process refund in transaction - create refund records BEFORE Stripe calls
    await db.transaction(async (tx) => {
      let remaining = refundAmount;
      console.log(`[Refund] Starting refund process:`, {
        orderId: input.orderId,
        refundAmount,
        refundType: input.refundType,
        refundedItems: input.refundedItems,
      });
      const createdRefunds: Array<{
        refundId: string;
        paymentId: string;
        amount: number;
        provider: string;
        stripeRefundId: string | null;
      }> = [];

      // Process refunds per payment (prioritize Stripe payments)
      // Sort: Stripe payments first, then manual
      const sortedPayments = [...refundablePayments].sort((a, b) => {
        if (a.provider === "stripe" && b.provider !== "stripe") return -1;
        if (a.provider !== "stripe" && b.provider === "stripe") return 1;
        return 0;
      });

      for (const payment of sortedPayments) {
        if (remaining <= 0) break;

        // Re-fetch payment data inside transaction to get current refundedAmount
        const currentPaymentData = await tx
          .select({
            amount: orderPayments.amount,
            refundedAmount: orderPayments.refundedAmount,
          })
          .from(orderPayments)
          .where(eq(orderPayments.id, payment.id))
          .limit(1);

        if (currentPaymentData.length === 0) {
          console.error(
            `[Refund] Payment ${payment.id} not found in transaction`
          );
          continue;
        }

        const currentRefunded = parseFloat(
          currentPaymentData[0].refundedAmount || "0"
        );
        const paymentAmount = parseFloat(currentPaymentData[0].amount);
        const currentRefundable = paymentAmount - currentRefunded;

        const refundThisPayment = Math.min(currentRefundable, remaining);
        console.log(`[Refund] Processing refund for payment:`, {
          paymentId: payment.id,
          paymentAmount,
          currentRefunded,
          currentRefundable,
          refundThisPayment,
          remaining,
        });

        // Create refund record FIRST (before Stripe API call)
        const refundRecord = await tx
          .insert(orderRefunds)
          .values({
            orderId: input.orderId,
            orderPaymentId: payment.id,
            provider: payment.provider || "manual",
            amount: refundThisPayment.toString(),
            reason: input.reason || null,
            status: payment.provider === "stripe" ? "pending" : "succeeded",
            metadata: input.refundedItems
              ? {
                  refundedItems: input.refundedItems,
                }
              : null,
            createdBy: userId,
          })
          .returning();

        const refundId = refundRecord[0]?.id;
        if (!refundId) {
          throw new Error("Failed to create refund record");
        }

        // Create refund items if provided
        if (input.refundedItems && input.refundedItems.length > 0) {
          const refundItems = input.refundedItems.map((item) => ({
            refundId,
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          }));
          await tx.insert(orderRefundItems).values(refundItems);
        }

        // Stripe refund is async - call API after creating record
        let stripeRefundId: string | null = null;
        if (
          payment.provider === "stripe" &&
          payment.stripePaymentIntentId &&
          storeStripeAccountId
        ) {
          try {
            const { stripe } = await import("@/lib/stripe");
            const refundAmountCents = Math.round(refundThisPayment * 100);

            console.log(`[Refund] Creating Stripe refund:`, {
              paymentIntentId: payment.stripePaymentIntentId,
              amount: refundAmountCents,
              refundId,
            });

            // Retrieve payment intent to get charge ID
            const paymentIntent = await stripe.paymentIntents.retrieve(
              payment.stripePaymentIntentId
            );

            const chargeId = paymentIntent.latest_charge;
            if (!chargeId) {
              throw new Error("No charge found on payment intent");
            }

            // Create refund on platform account
            // Note: No reverse_transfer needed since funds are held in platform account
            const refund = await stripe.refunds.create({
              charge: typeof chargeId === "string" ? chargeId : chargeId.id,
              amount: refundAmountCents,
              refund_application_fee: false,
              // No reverse_transfer - funds are held in platform account, not transferred
            });

            stripeRefundId = refund.id;

            // Update refund record with Stripe refund ID
            await tx
              .update(orderRefunds)
              .set({
                stripeRefundId,
                updatedAt: new Date(),
              })
              .where(eq(orderRefunds.id, refundId));

            console.log(
              `[Refund] ✅ Stripe refund created: ${refund.id} for refund record ${refundId}`
            );
          } catch (stripeError) {
            console.error(
              `[Refund] ❌ Stripe refund failed for refund ${refundId}:`,
              stripeError
            );
            // Mark refund as failed - webhook will update it if Stripe succeeds later
            await tx
              .update(orderRefunds)
              .set({
                status: "failed",
                updatedAt: new Date(),
              })
              .where(eq(orderRefunds.id, refundId));
            // Continue with next payment - don't throw
          }
        }

        createdRefunds.push({
          refundId,
          paymentId: payment.id,
          amount: refundThisPayment,
          provider: payment.provider || "manual",
          stripeRefundId,
        });

        // For manual refunds, update orderPayments.refundedAmount immediately
        // (Stripe refunds will be updated by webhooks when refund.updated is received)
        if (payment.provider !== "stripe") {
          // Use the already-fetched currentPaymentData from above
          const newRefundedAmount = currentRefunded + refundThisPayment;

          console.log(`[Refund] Updating payment refundedAmount:`, {
            paymentId: payment.id,
            currentRefunded,
            refundThisPayment,
            newRefundedAmount,
            paymentAmount,
            willBeStatus:
              newRefundedAmount >= paymentAmount - 0.01
                ? "refunded"
                : "partially_refunded",
          });

          await tx
            .update(orderPayments)
            .set({
              refundedAmount: newRefundedAmount.toString(),
              status:
                newRefundedAmount >= paymentAmount - 0.01
                  ? "refunded"
                  : "partially_refunded",
              updatedAt: new Date(),
            })
            .where(eq(orderPayments.id, payment.id));
        }

        remaining -= refundThisPayment;
      }

      // Recalculate order payment status (for manual refunds, this updates immediately)
      // For Stripe refunds, webhooks will call this when refund.updated is received
      console.log(`[Refund] Recalculating order payment status...`);
      await recalculateOrderPaymentStatus(input.orderId, tx);

      // Step 5: Inventory adjustment (ONLY if chosen)
      // Only restock the quantities that were actually refunded
      if (input.restockItems && order.storeId && input.refundedItems) {
        // Group refunded items by variantId and sum quantities
        const variantQuantities = new Map<string, number>();

        for (const refundedItem of input.refundedItems) {
          const orderItem = orderItemsData.find(
            (item) => item.id === refundedItem.orderItemId
          );
          if (orderItem?.variantId) {
            const current = variantQuantities.get(orderItem.variantId) || 0;
            variantQuantities.set(
              orderItem.variantId,
              current + refundedItem.quantity
            );
          }
        }

        // Restock each variant with the refunded quantity
        for (const [variantId, quantity] of variantQuantities.entries()) {
          if (quantity > 0) {
            await adjustInventoryForOrder(
              [{ variantId, quantity }],
              order.storeId,
              "restock",
              "refund",
              input.orderId,
              true // skipAuth for transaction context
            );
          }
        }
      } else if (input.restockItems && order.storeId && !input.refundedItems) {
        // Fallback: if no item-level data, restock all items (for backward compatibility)
        for (const item of orderItemsData) {
          if (item.variantId) {
            await adjustInventoryForOrder(
              [{ variantId: item.variantId, quantity: item.quantity }],
              order.storeId,
              "restock",
              "refund",
              input.orderId,
              true // skipAuth for transaction context
            );
          }
        }
      }

      // Step 9: Update seller balance ledger for refund
      // Debit the refunded amount from seller balance
      // Note: This is done in the transaction to ensure consistency
      // The webhook will also update balance when Stripe confirms, but we do it here too
      // to ensure it's recorded even if webhook is delayed
      try {
        const { updateSellerBalance } = await import("./seller-balance");
        await updateSellerBalance({
          storeId: order.storeId!,
          type: "refund",
          amount: refundAmount, // Will be debited (negative)
          currency: order.currency,
          orderId: input.orderId,
          description: `Refund processed (${refundAmount.toFixed(2)} ${order.currency})`,
        });
        console.log(
          `[Refund] ✅ Seller balance debited for refund: ${refundAmount} ${order.currency}`
        );
      } catch (balanceError) {
        console.error("[Refund] Error updating seller balance:", balanceError);
        // Don't fail the refund if balance update fails - webhook will handle it
      }

      // Step 10: Timeline / audit log
      const restockMessage = input.restockItems ? " Inventory restocked." : "";
      const hasStripeRefunds = createdRefunds.some(
        (r) => r.provider === "stripe"
      );
      const refundMethod = hasStripeRefunds ? "Stripe" : "manual";
      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "refund_processed",
        visibility: "internal",
        message: `Refund of ${refundAmount.toFixed(2)} ${order.currency} processed (${refundMethod}).${restockMessage}`,
        metadata: {
          refundAmount,
          refundType: input.refundType,
          reason: input.reason,
          restockItems: input.restockItems,
          refundIds: createdRefunds.map((r) => r.refundId),
        },
        createdBy: userId,
        createdAt: new Date(),
      });
    });

    // Step 7: Generate refund document (credit note/receipt)
    // This will be done asynchronously to not block the response
    (async () => {
      try {
        const { generateRefundReceipt } = await import("./refund");
        await generateRefundReceipt({
          orderId: input.orderId,
          refundAmount: refundAmount.toString(),
          currency: order.currency,
          reason: input.reason,
        });
      } catch (receiptError) {
        console.error(
          "[Refund] Error generating refund receipt:",
          receiptError
        );
        // Don't fail the refund if receipt generation fails
      }
    })();

    // Step 8: Send refund confirmation email
    if (order.customerEmail) {
      try {
        // Check if any refunds were created with Stripe
        const stripeRefunds = await db
          .select({ id: orderRefunds.id })
          .from(orderRefunds)
          .where(
            and(
              eq(orderRefunds.orderId, input.orderId),
              eq(orderRefunds.provider, "stripe"),
              or(
                eq(orderRefunds.status, "succeeded"),
                eq(orderRefunds.status, "pending")
              )
            )
          )
          .limit(1);

        const hasStripeRefunds = stripeRefunds.length > 0;

        const resend = (await import("@/lib/resend")).default;
        const RefundConfirmationEmail = (
          await import("@/app/[locale]/components/refund-confirmation-email")
        ).default;

        const customerName =
          order.customerFirstName && order.customerLastName
            ? `${order.customerFirstName} ${order.customerLastName}`
            : order.customerEmail || "Customer";

        let fromAddress =
          process.env.RESEND_FROM_EMAIL ||
          "Golden Market <goldenmarket@resend.dev>";
        if (fromAddress.includes("yourdomain.com")) {
          fromAddress = "Golden Market <goldenmarket@resend.dev>";
        }

        await resend.emails.send({
          from: fromAddress,
          to: order.customerEmail,
          subject: `Refund Processed - Order #${order.orderNumber}`,
          react: RefundConfirmationEmail({
            orderNumber: order.orderNumber,
            invoiceNumber: order.invoiceNumber,
            customerName,
            refundAmount: refundAmount.toString(),
            currency: order.currency,
            refundedItems: orderItemsData.map((item) => ({
              title: item.title,
              quantity: item.quantity,
            })),
            refundMethod: hasStripeRefunds
              ? "original payment method"
              : "manual",
          }),
        });

        console.log(
          `[Refund] Confirmation email sent to ${order.customerEmail}`
        );
      } catch (emailError) {
        console.error("[Refund] Error sending confirmation email:", emailError);
        // Don't fail the refund if email fails
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error processing refund:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process refund",
    };
  }
}

/**
 * Capture payment for an order (called when seller confirms order)
 * This should be called when seller marks order as "processing" or "accepted"
 */
export async function captureOrderPayment(orderId: string): Promise<{
  success: boolean;
  error?: string;
  paymentIntentId?: string;
}> {
  try {
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get order and payment info
    const orderData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        paymentStatus: orders.paymentStatus,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Permission check: seller can only capture their own orders
    if (!isAdmin && order.storeId !== storeId) {
      return { success: false, error: "Unauthorized" };
    }

    // Only capture if payment is still pending
    if (order.paymentStatus !== "pending") {
      return {
        success: false,
        error: `Payment already ${order.paymentStatus}. Cannot capture.`,
      };
    }

    // Import Stripe
    const { stripe } = await import("@/lib/stripe");

    // Get payment intent ID and payment details from orderPayments
    let paymentData = await db
      .select({
        id: orderPayments.id,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        amount: orderPayments.amount,
        currency: orderPayments.currency,
        platformFeeAmount: orderPayments.platformFeeAmount,
      })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, orderId))
      .limit(1);

    // Fallback: if webhook never ran (e.g. local dev without Stripe CLI), look up PaymentIntent by metadata
    if (paymentData.length === 0 || !paymentData[0].stripePaymentIntentId) {
      let match: { id: string } | null = null;
      try {
        const list = await stripe.paymentIntents.list({ limit: 100 });
        match =
          list.data.find(
            (pi) =>
              pi.metadata?.orderId === orderId &&
              (pi.status === "requires_capture" || pi.status === "succeeded")
          ) ?? null;
      } catch (e) {
        console.warn("Fallback: could not list payment intents:", e);
      }
      if (match) {
        const orderRow = await db
          .select({
            totalAmount: orders.totalAmount,
            currency: orders.currency,
          })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        if (orderRow.length > 0) {
          const totalAmount = parseFloat(orderRow[0].totalAmount || "0");
          const platformFee = totalAmount * 0.05;
          const [inserted] = await db
            .insert(orderPayments)
            .values({
              orderId,
              amount: totalAmount.toFixed(2),
              currency: orderRow[0].currency,
              provider: "stripe",
              providerPaymentId: match.id,
              platformFeeAmount: platformFee.toFixed(2),
              netAmountToStore: (totalAmount - platformFee).toFixed(2),
              stripePaymentIntentId: match.id,
              status: "completed",
              transferStatus: "held",
            })
            .returning();
          paymentData = [
            {
              id: inserted.id,
              stripePaymentIntentId: match.id,
              amount: totalAmount.toFixed(2),
              currency: orderRow[0].currency,
              platformFeeAmount: platformFee.toFixed(2),
            },
          ];
        }
      }
    }

    if (paymentData.length === 0 || !paymentData[0].stripePaymentIntentId) {
      return {
        success: false,
        error:
          "Payment intent not found. If you just paid, ensure the Stripe webhook is running (e.g. use Stripe CLI: stripe listen --forward-to localhost:3000/api/webhooks/stripe).",
      };
    }

    const paymentRecord = paymentData[0];
    const paymentIntentId = paymentRecord.stripePaymentIntentId!;

    // First, retrieve the payment intent to check its current status
    let paymentIntentBefore;
    try {
      paymentIntentBefore =
        await stripe.paymentIntents.retrieve(paymentIntentId);
      console.log("🔍 Payment Intent Before Capture:", {
        id: paymentIntentBefore.id,
        status: paymentIntentBefore.status,
        amount: paymentIntentBefore.amount,
        currency: paymentIntentBefore.currency,
        amount_capturable: paymentIntentBefore.amount_capturable,
        amount_received: paymentIntentBefore.amount_received,
      });
    } catch (retrieveError) {
      console.error("❌ Error retrieving payment intent:", retrieveError);
      return {
        success: false,
        error: `Failed to retrieve payment intent: ${retrieveError instanceof Error ? retrieveError.message : "Unknown error"}`,
      };
    }

    // Only capture if payment is still in requires_capture status
    if (paymentIntentBefore.status !== "requires_capture") {
      console.warn("⚠️ Payment intent not in requires_capture status:", {
        paymentIntentId,
        currentStatus: paymentIntentBefore.status,
      });
      return {
        success: false,
        error: `Payment intent is in ${paymentIntentBefore.status} status. Cannot capture. Expected: requires_capture`,
      };
    }

    // Capture payment in Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      console.log("✅ Payment Captured Successfully:", {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        amount_received: paymentIntent.amount_received,
        charge: paymentIntent.latest_charge,
      });
    } catch (captureError) {
      console.error("❌ Capture Failed:", {
        error: captureError,
        paymentIntentId,
        message:
          captureError instanceof Error
            ? captureError.message
            : "Unknown error",
      });
      return {
        success: false,
        error: `Failed to capture payment: ${captureError instanceof Error ? captureError.message : "Unknown error"}`,
      };
    }

    // Verify capture succeeded
    if (paymentIntent.status !== "succeeded") {
      console.warn("⚠️ Payment Intent not succeeded after capture:", {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
      return {
        success: false,
        error: `Payment capture completed but status is ${paymentIntent.status}, not succeeded. Please check Stripe dashboard.`,
      };
    }

    // Verify amount was actually received
    if (paymentIntent.amount_received !== paymentIntent.amount) {
      console.warn("⚠️ Amount received doesn't match amount:", {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        amount_received: paymentIntent.amount_received,
      });
      return {
        success: false,
        error: `Payment captured but amount received (${paymentIntent.amount_received / 100}) doesn't match expected amount (${paymentIntent.amount / 100}). Please check Stripe dashboard.`,
      };
    }

    // Update order payment status
    await updatePaymentStatus(orderId, "paid");

    // Update seller balance now that payment is captured
    // This ensures the ledger reflects actual funds available in Stripe
    if (!order.storeId) {
      return {
        success: false,
        error: "Order has no associated store",
      };
    }

    const orderStoreId: string = order.storeId; // TypeScript now knows this is string
    const { updateSellerBalance } = await import("./seller-balance");

    const totalAmount = parseFloat(paymentRecord.amount);
    const platformFee = parseFloat(paymentRecord.platformFeeAmount || "0");

    // Calculate Stripe fee (2.9% + €0.30)
    const stripeFeeRate = 0.029;
    const stripeFeeFixed = 0.3;
    const stripeFee = totalAmount * stripeFeeRate + stripeFeeFixed;

    // Update seller balance with captured payment
    // 1. Order payment (CREDIT)
    await updateSellerBalance({
      storeId: orderStoreId,
      type: "order_payment",
      amount: totalAmount,
      currency: paymentRecord.currency,
      orderId: orderId,
      orderPaymentId: paymentRecord.id,
      description: `Order payment captured`,
    });

    // 2. Platform fee (DEBIT)
    await updateSellerBalance({
      storeId: orderStoreId,
      type: "platform_fee",
      amount: platformFee,
      currency: paymentRecord.currency,
      orderId: orderId,
      orderPaymentId: paymentRecord.id,
      description: `Platform fee (5%) for order`,
    });

    // 3. Stripe fee (DEBIT)
    await updateSellerBalance({
      storeId: orderStoreId,
      type: "stripe_fee",
      amount: stripeFee,
      currency: paymentRecord.currency,
      orderId: orderId,
      orderPaymentId: paymentRecord.id,
      description: `Stripe processing fee for order`,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error("Error capturing payment:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to capture payment",
    };
  }
}

/**
 * Cancel order (customer-initiated, before fulfillment)
 *
 * Rules:
 * - Only allowed if fulfillmentStatus === "unfulfilled"
 * - If payment not captured → void payment (no fees)
 * - If payment captured → refund (Stripe fee applies, platform absorbs)
 */
export async function cancelOrderByCustomer(
  orderId: string,
  reason?: string
): Promise<{
  success: boolean;
  error?: string;
  refundMethod?: "void" | "refund";
}> {
  try {
    // Get current user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get order
    const orderData = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        customerEmail: orders.customerEmail,
        storeId: orders.storeId,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Permission: Only customers can cancel orders, and only their own orders
    const { isCustomer, allCustomerIds } = await getStoreIdForUser();
    if (!isCustomer) {
      return {
        success: false,
        error: "Unauthorized. Only customers can cancel orders.",
      };
    }

    // Check if order belongs to any of the user's customer records
    if (!order.customerId || !allCustomerIds.includes(order.customerId)) {
      return { success: false, error: "Unauthorized" };
    }

    // Validation: Can only cancel if not fulfilled
    if (
      order.fulfillmentStatus !== "unfulfilled" &&
      order.fulfillmentStatus !== "partial"
    ) {
      return {
        success: false,
        error:
          "Order cannot be cancelled. It has already been fulfilled or shipped.",
      };
    }

    // Validation: Cannot cancel if already canceled
    if (order.status === "canceled") {
      return { success: false, error: "Order is already canceled" };
    }

    return await db.transaction(async (tx) => {
      // Get payment info
      const paymentData = await tx
        .select({
          id: orderPayments.id,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          amount: orderPayments.amount,
          status: orderPayments.status,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, orderId))
        .limit(1);

      let refundMethod: "void" | "refund" = "refund";

      // Handle payment based on capture status
      if (paymentData.length > 0 && paymentData[0].stripePaymentIntentId) {
        const paymentIntentId = paymentData[0].stripePaymentIntentId;

        // Check if payment is captured
        const { stripe } = await import("@/lib/stripe");
        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === "requires_capture") {
          // ✅ BEST CASE: Payment not captured → void (no fees)
          await stripe.paymentIntents.cancel(paymentIntentId);
          refundMethod = "void";

          // Update payment status
          await tx
            .update(orderPayments)
            .set({
              status: "void",
              updatedAt: new Date(),
            })
            .where(eq(orderPayments.id, paymentData[0].id));
        } else if (paymentIntent.status === "succeeded") {
          // Payment captured → must refund (Stripe fee applies)
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: Math.round(parseFloat(order.totalAmount) * 100), // Full refund
            reason: "requested_by_customer",
            metadata: {
              orderId: orderId,
              reason: reason || "Customer cancellation",
              refundMethod: "cancellation",
            },
          });

          // Create refund record
          await tx.insert(orderRefunds).values({
            orderId: orderId,
            orderPaymentId: paymentData[0].id,
            provider: "stripe",
            amount: order.totalAmount,
            reason: reason || "Customer cancellation",
            stripeRefundId: refund.id,
            status: refund.status === "succeeded" ? "succeeded" : "pending",
            feePaidBy: "platform", // Platform absorbs fee for cancellations
            refundMethod: "refund",
            metadata: {
              cancellation: true,
              requestedBy: session.user.id,
            },
            createdBy: session.user.id,
          });

          // Update payment record
          await tx
            .update(orderPayments)
            .set({
              refundedAmount: order.totalAmount,
              status: "refunded",
              updatedAt: new Date(),
            })
            .where(eq(orderPayments.id, paymentData[0].id));

          refundMethod = "refund";
        }
      }

      // Update order status
      await tx
        .update(orders)
        .set({
          status: "canceled",
          paymentStatus: refundMethod === "void" ? "void" : "refunded",
          fulfillmentStatus: "canceled",
          canceledAt: new Date(),
          cancellationReason: reason || null,
          cancellationRequestedBy: session.user.id,
          cancellationRequestedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // Release inventory (if any was reserved)
      // TODO: Add inventory release logic here if needed

      return {
        success: true,
        refundMethod,
      };
    });
  } catch (error) {
    console.error("Error canceling order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
    };
  }
}

/**
 * Request refund (customer-initiated, after fulfillment)
 */
export async function requestRefund(
  orderId: string,
  reason: string,
  description?: string,
  evidenceImages?: string[]
): Promise<{
  success: boolean;
  error?: string;
  refundRequestId?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get order
    const orderData = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        refundRequestStatus: orders.refundRequestStatus,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Permission check: Only customers can request refunds
    const { isCustomer, allCustomerIds } = await getStoreIdForUser();
    if (!isCustomer) {
      return {
        success: false,
        error: "Unauthorized. Only customers can request refunds.",
      };
    }

    // Check if order belongs to any of the user's customer records
    if (!order.customerId || !allCustomerIds.includes(order.customerId)) {
      return { success: false, error: "Unauthorized" };
    }

    // Validation: Can only request refund if order is fulfilled/shipped
    if (order.fulfillmentStatus === "unfulfilled") {
      return {
        success: false,
        error: "Order not yet fulfilled. Please cancel the order instead.",
      };
    }

    // Validation: Cannot request if already requested/approved/rejected
    if (order.refundRequestStatus && order.refundRequestStatus !== "none") {
      if (order.refundRequestStatus === "pending") {
        return {
          success: false,
          error: "Refund request already pending",
        };
      }
      return {
        success: false,
        error: `Refund request already ${order.refundRequestStatus}`,
      };
    }

    // Validation: Must be paid
    if (
      order.paymentStatus !== "paid" &&
      order.paymentStatus !== "partially_refunded"
    ) {
      return {
        success: false,
        error: "Order payment not completed. Cannot request refund.",
      };
    }

    // Create refund request
    const [refundRequest] = await db
      .insert(refundRequests)
      .values({
        orderId: orderId,
        customerId: order.customerId,
        reason: reason,
        description: description || null,
        evidenceImages: evidenceImages || [],
        status: "pending",
      })
      .returning();

    // Update order
    await db
      .update(orders)
      .set({
        refundRequestStatus: "pending",
        refundRequestedAt: new Date(),
        refundRequestReason: reason,
      })
      .where(eq(orders.id, orderId));

    // TODO: Send notification to seller

    return {
      success: true,
      refundRequestId: refundRequest.id,
    };
  } catch (error) {
    console.error("Error requesting refund:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request refund",
    };
  }
}

/**
 * Process refund request (seller/admin approval)
 *
 * Fee ownership logic:
 * - Seller fault → seller pays fee
 * - Customer reason → seller pays fee
 * - Platform error → platform pays fee
 */
export async function processRefundRequest(
  refundRequestId: string,
  action: "approve" | "reject",
  feePaidBy: "platform" | "seller" = "seller",
  rejectionReason?: string
): Promise<{
  success: boolean;
  error?: string;
  refundId?: string;
}> {
  try {
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get refund request
    const requestData = await db
      .select({
        id: refundRequests.id,
        orderId: refundRequests.orderId,
        status: refundRequests.status,
        reason: refundRequests.reason,
      })
      .from(refundRequests)
      .where(eq(refundRequests.id, refundRequestId))
      .limit(1);

    if (requestData.length === 0) {
      return { success: false, error: "Refund request not found" };
    }

    const request = requestData[0];

    if (request.status !== "pending") {
      return {
        success: false,
        error: `Refund request already ${request.status}`,
      };
    }

    // Get order
    const orderData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        refundedAmount: orders.refundedAmount,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, request.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Permission: Seller can only process their own orders, admin can process any
    if (!isAdmin && order.storeId !== storeId) {
      return { success: false, error: "Unauthorized" };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (action === "reject") {
      // Reject refund request
      await db
        .update(refundRequests)
        .set({
          status: "rejected",
          reviewedBy: session?.user?.id || null,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || null,
        })
        .where(eq(refundRequests.id, refundRequestId));

      await db
        .update(orders)
        .set({
          refundRequestStatus: "rejected",
        })
        .where(eq(orders.id, request.orderId));

      return { success: true };
    }

    // Approve refund
    return await db.transaction(async (tx) => {
      // Get payment info
      const paymentData = await tx
        .select({
          id: orderPayments.id,
          stripePaymentIntentId: orderPayments.stripePaymentIntentId,
          amount: orderPayments.amount,
          refundedAmount: orderPayments.refundedAmount,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, request.orderId))
        .limit(1);

      if (paymentData.length === 0 || !paymentData[0].stripePaymentIntentId) {
        throw new Error("Payment not found");
      }

      const payment = paymentData[0];
      const refundAmount =
        parseFloat(order.totalAmount) - parseFloat(order.refundedAmount);

      // Process Stripe refund
      const { stripe } = await import("@/lib/stripe");
      if (!payment.stripePaymentIntentId) {
        throw new Error("Payment intent ID not found");
      }
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: "requested_by_customer",
        metadata: {
          orderId: request.orderId,
          refundRequestId: refundRequestId,
          feePaidBy: feePaidBy,
        },
      });

      // Calculate Stripe fee (not refunded)
      // Stripe fee = original payment amount * 0.029 + 0.30 (example, adjust to your rates)
      const originalAmount = parseFloat(payment.amount);
      const stripeFee = originalAmount * 0.029 + 0.3; // Adjust based on your Stripe rates

      // Create refund record
      const [refundRecord] = await tx
        .insert(orderRefunds)
        .values({
          orderId: request.orderId,
          orderPaymentId: payment.id,
          provider: "stripe",
          amount: refundAmount.toFixed(2),
          reason: request.reason,
          stripeRefundId: refund.id,
          status: refund.status === "succeeded" ? "succeeded" : "pending",
          feePaidBy: feePaidBy,
          stripeFeeAmount: stripeFee.toFixed(2),
          refundMethod: "refund",
          createdBy: session?.user?.id || null,
        })
        .returning();

      // Update payment record
      const newRefundedAmount =
        parseFloat(payment.refundedAmount) + refundAmount;
      const newPaymentStatus =
        newRefundedAmount >= originalAmount ? "refunded" : "partially_refunded";

      await tx
        .update(orderPayments)
        .set({
          refundedAmount: newRefundedAmount.toFixed(2),
          status: newPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orderPayments.id, payment.id));

      // Update order
      const newOrderRefundedAmount =
        parseFloat(order.refundedAmount) + refundAmount;
      const newOrderPaymentStatus =
        newOrderRefundedAmount >= parseFloat(order.totalAmount)
          ? "refunded"
          : "partially_refunded";

      await tx
        .update(orders)
        .set({
          refundedAmount: newOrderRefundedAmount.toFixed(2),
          paymentStatus: newOrderPaymentStatus,
          refundRequestStatus: "approved",
        })
        .where(eq(orders.id, request.orderId));

      // Update refund request
      await tx
        .update(refundRequests)
        .set({
          status: "approved",
          reviewedBy: session?.user?.id || null,
          reviewedAt: new Date(),
        })
        .where(eq(refundRequests.id, refundRequestId));

      // Update seller balance (deduct if seller pays fee)
      if (feePaidBy === "seller" && order.storeId) {
        const { updateSellerBalance } = await import(
          "@/app/[locale]/actions/seller-balance"
        );
        await updateSellerBalance({
          storeId: order.storeId,
          type: "stripe_fee", // Use stripe_fee type for refund fees
          amount: stripeFee, // Amount is always positive, type determines debit
          currency: order.currency,
          orderId: request.orderId,
          description: `Stripe fee for refund: ${request.reason}`,
        });
      }

      return {
        success: true,
        refundId: refundRecord.id,
      };
    });
  } catch (error) {
    console.error("Error processing refund request:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process refund",
    };
  }
}
