"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  customers,
  vendor,
  inventoryItems,
  inventoryLevels,
  inventoryAdjustments,
  listingVariants,
  listing,
  userRoles,
  roles,
  user,
  shippingBillingInfo,
} from "@/db/schema";
import { eq, and, sql, like, or, desc, asc, inArray, isNull } from "drizzle-orm";
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
  paymentStatus: "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void";
  fulfillmentStatus: "unfulfilled" | "partial" | "fulfilled" | "canceled" | "on_hold";
  status: "open" | "draft" | "archived" | "canceled";
  placedAt: Date | null;
  createdAt: Date;
  itemsCount: number;
};

export type OrderFilters = {
  search?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
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
  paymentStatus?: "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void";
  fulfillmentStatus?: "unfulfilled" | "partial" | "fulfilled" | "canceled" | "on_hold";
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
      const firstName = customer.firstName || (userRecord?.name?.split(" ")[0] || null);
      const lastName = customer.lastName || (userRecord?.name?.split(" ").slice(1).join(" ") || null);
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

    // Get vendor ID for the customer
    const { vendorId } = await getVendorIdForUser();

    // Extract first/last name from user.name if available
    const nameParts = userRecord.name?.split(" ") || [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(" ") || null;

    // Create new customer
    const newCustomer = await db
      .insert(customers)
      .values({
        vendorId: vendorId || null,
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
export async function checkCustomerEmailExists(
  email: string
): Promise<{
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
 * Get vendor ID for current user (or check if admin)
 */
async function getVendorIdForUser(): Promise<{
  vendorId: string | null;
  isAdmin: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return { vendorId: null, isAdmin: false, error: "Unauthorized" };
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
    userRole.length > 0 &&
    userRole[0].roleName.toLowerCase() === "admin";

  if (isAdmin) {
    return { vendorId: null, isAdmin: true };
  }

  // Get vendor for current user
  const vendorResult = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(eq(vendor.ownerUserId, session.user.id))
    .limit(1);

  if (vendorResult.length === 0) {
    return {
      vendorId: null,
      isAdmin: false,
      error: "Vendor not found. Please set up your vendor information.",
    };
  }

  return { vendorId: vendorResult[0].id, isAdmin: false };
}

/**
 * Find default inventory location for a vendor
 */
async function getDefaultInventoryLocation(
  vendorId: string
): Promise<string | null> {
  const location = await db
    .select({ id: inventoryLevels.locationId })
    .from(inventoryLevels)
    .innerJoin(inventoryItems, eq(inventoryLevels.inventoryItemId, inventoryItems.id))
    .innerJoin(listingVariants, eq(inventoryItems.variantId, listingVariants.id))
    .innerJoin(listing, eq(listingVariants.listingId, listing.id))
    .innerJoin(vendor, eq(listing.vendorId, vendor.id))
    .where(eq(vendor.id, vendorId))
    .limit(1);

  if (location.length > 0) {
    return location[0].id;
  }

  // Fallback: get first active location for vendor
  const fallbackLocation = await db
    .select({ id: inventoryLevels.locationId })
    .from(inventoryLevels)
    .innerJoin(inventoryItems, eq(inventoryLevels.inventoryItemId, inventoryItems.id))
    .innerJoin(listingVariants, eq(inventoryItems.variantId, listingVariants.id))
    .innerJoin(listing, eq(listingVariants.listingId, listing.id))
    .where(eq(listing.vendorId, vendorId))
    .limit(1);

  return fallbackLocation.length > 0 ? fallbackLocation[0].id : null;
}

/**
 * Check stock availability for order items
 */
async function checkStockAvailability(
  lineItems: Array<{ variantId: string | null; quantity: number }>,
  vendorId: string
): Promise<{ success: boolean; error?: string; unavailableItems?: Array<{ variantId: string; available: number; requested: number }> }> {
  try {
    const locationId = await getDefaultInventoryLocation(vendorId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    const unavailableItems: Array<{ variantId: string; available: number; requested: number }> = [];

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

      const available = inventoryLevel.length > 0 ? Number(inventoryLevel[0].available) : 0;

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
      error: error instanceof Error ? error.message : "Failed to check stock availability",
    };
  }
}

/**
 * Adjust inventory for order items
 */
async function adjustInventoryForOrder(
  orderItems: Array<{ variantId: string | null; quantity: number }>,
  vendorId: string,
  direction: "reserve" | "release" | "fulfill",
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const locationId = await getDefaultInventoryLocation(vendorId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    for (const item of orderItems) {
      if (!item.variantId) continue;

      // Find inventory item for this variant
      const inventoryItem = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.variantId, item.variantId))
        .limit(1);

      if (inventoryItem.length === 0) continue;

      const invItemId = inventoryItem[0].id;

      // Find or create inventory level
      let inventoryLevel = await db
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
        await db.insert(inventoryLevels).values({
          inventoryItemId: invItemId,
          locationId: locationId,
          available: 0,
          committed: 0,
          incoming: 0,
        });
        inventoryLevel = await db
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
        await db
          .update(inventoryLevels)
          .set({
            available: sql`${inventoryLevels.available} - ${quantity}`,
            committed: sql`${inventoryLevels.committed} + ${quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryLevels.id, level.id));

        // Log adjustment
        await db.insert(inventoryAdjustments).values({
          inventoryItemId: invItemId,
          locationId: locationId,
          change: -quantity,
          reason: reason,
          createdBy: session.user.id,
        });
      } else if (direction === "release") {
        // committed -= qty, available += qty
        await db
          .update(inventoryLevels)
          .set({
            committed: sql`${inventoryLevels.committed} - ${quantity}`,
            available: sql`${inventoryLevels.available} + ${quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryLevels.id, level.id));

        // Log adjustment
        await db.insert(inventoryAdjustments).values({
          inventoryItemId: invItemId,
          locationId: locationId,
          change: quantity,
          reason: reason,
          createdBy: session.user.id,
        });
      } else if (direction === "fulfill") {
        // committed -= qty (no change to available)
        await db
          .update(inventoryLevels)
          .set({
            committed: sql`${inventoryLevels.committed} - ${quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryLevels.id, level.id));
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to adjust inventory",
    };
  }
}

/**
 * List orders with filters and pagination
 */
export async function listOrders(
  filters: OrderFilters = {}
): Promise<{
  success: boolean;
  data?: OrderRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin, error: vendorError } = await getVendorIdForUser();

    if (vendorError) {
      return { success: false, error: vendorError };
    }

    // Build where conditions
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [];

    if (!isAdmin && vendorId) {
      // For vendors, show orders that have at least one item from their listings
      // This ensures vendors see orders with their products, even if order.vendorId is set to a different vendor
      // (e.g., when an admin creates an order with items from multiple vendors)
      conditions.push(
        sql`EXISTS (
          SELECT 1 
          FROM ${orderItems} oi
          INNER JOIN ${listing} l ON oi.listing_id = l.id
          WHERE oi.order_id = ${orders.id}
          AND l.vendor_id = ${vendorId}
        )`
      );
    }

    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      conditions.push(eq(orders.paymentStatus, filters.paymentStatus as "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void"));
    }

    if (filters.fulfillmentStatus && filters.fulfillmentStatus !== "all") {
      conditions.push(eq(orders.fulfillmentStatus, filters.fulfillmentStatus as "unfulfilled" | "partial" | "fulfilled" | "canceled" | "on_hold"));
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
    // For vendors, we need to ensure we're counting distinct orders that match the conditions
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

    // For vendors, we need to count only items from their listings
    // For admins, count all items
    let itemsCountExpression: ReturnType<typeof sql>;
    
    if (!isAdmin && vendorId) {
      // Count only items from this vendor's listings
      itemsCountExpression = sql<number>`COUNT(CASE WHEN ${listing.vendorId} = ${vendorId} THEN ${orderItems.id} END)::int`;
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
        orders.createdAt
      )
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      data: data.map((row) => ({
        ...row,
        itemsCount: Number(row.itemsCount) || 0,
      })),
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
export async function createOrder(
  input: CreateOrderInput
): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin, error: vendorError } = await getVendorIdForUser();

    if (vendorError) {
      return { success: false, error: vendorError };
    }

    if (!isAdmin && !vendorId) {
      return { success: false, error: "Vendor not found" };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Use provided vendorId or get from user
    let finalVendorId = vendorId;
    
    // For admins, determine vendorId from line items
    // Get vendorId from all line items to ensure we assign customer to the correct vendor
    if (isAdmin && input.lineItems && input.lineItems.length > 0) {
      // Get all unique listing IDs from line items
      const listingIds = [...new Set(input.lineItems.map(item => item.listingId))];
      
      // Get vendor IDs for all listings
      const listingsResult = await db
        .select({ vendorId: listing.vendorId })
        .from(listing)
        .where(inArray(listing.id, listingIds));
      
      // Get unique vendor IDs
      const vendorIds = [...new Set(listingsResult.map(l => l.vendorId).filter((id): id is string => id !== null))];
      
      // If all items are from one vendor, use that vendorId
      // If items are from multiple vendors, use the first vendor (or we could use the majority)
      if (vendorIds.length === 1) {
        finalVendorId = vendorIds[0];
      } else if (vendorIds.length > 1 && !finalVendorId) {
        // Multiple vendors - use the first one
        // In the future, we might want to create separate customer records per vendor
        finalVendorId = vendorIds[0];
      } else if (vendorIds.length === 0 && !finalVendorId) {
        // No vendor found in listings - try to get from first listing
        const firstListingId = input.lineItems[0].listingId;
        const listingResult = await db
          .select({ vendorId: listing.vendorId })
          .from(listing)
          .where(eq(listing.id, firstListingId))
          .limit(1);
        
        if (listingResult.length > 0 && listingResult[0].vendorId) {
          finalVendorId = listingResult[0].vendorId;
        }
      }
    }

    // If still no vendorId, allow null for admins (vendorId is nullable in schema)
    // For non-admins, vendorId should already be set from getVendorIdForUser

    return await db.transaction(async (tx) => {
      // Handle customer creation/finding according to edge case logic
      let customerId = input.customerId;

      if (!customerId && input.customerEmail) {
        // Check if this email belongs to the logged-in user
        const isLoggedInUser = userEmail && userEmail.toLowerCase() === input.customerEmail.toLowerCase();
        
        let existingCustomer;
        
        if (isLoggedInUser) {
          // Priority 1: If email matches logged-in user, first check by userId
          existingCustomer = await tx
            .select({ id: customers.id, userId: customers.userId, vendorId: customers.vendorId })
            .from(customers)
            .where(eq(customers.userId, userId))
            .limit(1);
          
          // Priority 2: If no customer found by userId, check by email (regardless of vendorId)
          // This handles cases where customer was created before userId linking was implemented
          if (existingCustomer.length === 0) {
            existingCustomer = await tx
              .select({ id: customers.id, userId: customers.userId, vendorId: customers.vendorId })
              .from(customers)
              .where(eq(customers.email, input.customerEmail))
              .limit(1);
          }
        } else {
          // For other users' emails: Check if customer exists with SAME email AND SAME vendorId
          // This ensures vendor isolation for different users
          existingCustomer = await tx
            .select({ id: customers.id, userId: customers.userId, vendorId: customers.vendorId })
            .from(customers)
            .where(
              and(
                eq(customers.email, input.customerEmail),
                finalVendorId
                  ? eq(customers.vendorId, finalVendorId)
                  : isNull(customers.vendorId)
              )
            )
            .limit(1);
        }

        if (existingCustomer.length > 0) {
          // Found existing customer - use it and update if needed
          const customer = existingCustomer[0];
          
          // Update customer record if needed
          const updateData: {
            vendorId?: string | null;
            userId?: string;
            firstName?: string | null;
            lastName?: string | null;
            phone?: string | null;
          } = {};
          
          // Link userId if this is the logged-in user and userId is missing
          if (isLoggedInUser && !customer.userId) {
            updateData.userId = userId;
          }
          
          // Update vendorId if customer has null vendorId but we have one
          if (finalVendorId && !customer.vendorId) {
            updateData.vendorId = finalVendorId;
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
              vendorId: finalVendorId,
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
      if (orderStatus === "open" && finalVendorId) {
        const stockCheck = await checkStockAvailability(
          input.lineItems.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          finalVendorId
        );

        if (!stockCheck.success) {
          // Get variant details for error message
          const variantIds = stockCheck.unavailableItems?.map((item) => item.variantId) || [];
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
            error: stockCheck.error || "Insufficient stock for one or more items",
          };
        }
      }

      const paymentStatus = input.paymentStatus || "pending";
      const fulfillmentStatus = input.fulfillmentStatus || "unfulfilled";

      const newOrder = await tx
        .insert(orders)
        .values({
          vendorId: finalVendorId,
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
      if (orderStatus === "open" && finalVendorId) {
        const inventoryResult = await adjustInventoryForOrder(
          input.lineItems.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          finalVendorId,
          "reserve",
          "order_created"
        );

        if (!inventoryResult.success) {
          throw new Error(inventoryResult.error || "Failed to adjust inventory");
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
  newStatus: "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: vendorError } = await getVendorIdForUser();

    if (vendorError) {
      return { success: false, error: vendorError };
    }

    const updateData: {
      paymentStatus: "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void";
      updatedAt: Date;
      paidAt?: Date;
    } = {
      paymentStatus: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "paid") {
      updateData.paidAt = new Date();
    }

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    return { success: true };
  } catch (error) {
    console.error("Error updating payment status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update payment status",
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
    const { vendorId, error: vendorError } = await getVendorIdForUser();

    if (vendorError) {
      return { success: false, error: vendorError };
    }

    // Get current order status
    const currentOrder = await db
      .select({
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (currentOrder.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const currentFulfillmentStatus = currentOrder[0].fulfillmentStatus;

    // Get order items
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Handle status transitions
    if (currentFulfillmentStatus === "unfulfilled" && newStatus === "fulfilled") {
      // committed -= qty
      if (vendorId) {
        const inventoryResult = await adjustInventoryForOrder(
          items.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          vendorId,
          "fulfill",
          "order_fulfilled"
        );

        if (!inventoryResult.success) {
          return { success: false, error: inventoryResult.error };
        }
      }

      await db
        .update(orders)
        .set({
          fulfillmentStatus: newStatus,
          fulfilledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    } else if (
      (currentFulfillmentStatus === "unfulfilled" || currentFulfillmentStatus === "partial") &&
      newStatus === "canceled"
    ) {
      // Restock: committed -= qty, available += qty
      if (vendorId) {
        const inventoryResult = await adjustInventoryForOrder(
          items.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          vendorId,
          "release",
          "order_canceled"
        );

        if (!inventoryResult.success) {
          return { success: false, error: inventoryResult.error };
        }
      }

      await db
        .update(orders)
        .set({
          fulfillmentStatus: newStatus,
          status: "canceled",
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    } else {
      // Other status changes don't affect inventory
      await db
        .update(orders)
        .set({
          fulfillmentStatus: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating fulfillment status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update fulfillment status",
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
    // Get current order status and vendorId
    const orderData = await db
      .select({
        status: orders.status,
        vendorId: orders.vendorId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const currentStatus = orderData[0].status;
    const vendorId = orderData[0].vendorId;

    // Get order items for inventory adjustments
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Handle inventory adjustments based on status transitions
    if (currentStatus === "open" && newStatus !== "open" && vendorId) {
      // Releasing inventory: changing from "open" to "draft"/"archived"/"canceled"
      const inventoryResult = await adjustInventoryForOrder(
        items.map((item) => ({
          variantId: item.variantId || null,
          quantity: item.quantity,
        })),
        vendorId,
        "release",
        `order_status_changed_to_${newStatus}`
      );

      if (!inventoryResult.success) {
        return { success: false, error: inventoryResult.error || "Failed to release inventory" };
      }
    } else if (currentStatus !== "open" && newStatus === "open" && vendorId) {
      // Reserving inventory: changing from "draft"/"archived"/"canceled" to "open"
      const inventoryResult = await adjustInventoryForOrder(
        items.map((item) => ({
          variantId: item.variantId || null,
          quantity: item.quantity,
        })),
        vendorId,
        "reserve",
        "order_status_changed_to_open"
      );

      if (!inventoryResult.success) {
        return { success: false, error: inventoryResult.error || "Failed to reserve inventory" };
      }
    }

    const updateData: {
      status: string;
      updatedAt: Date;
      placedAt?: Date | null;
      canceledAt?: Date | null;
    } = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // Set placedAt when status changes to "open"
    if (newStatus === "open") {
      updateData.placedAt = new Date();
    }

    // Set canceledAt when status changes to "canceled"
    if (newStatus === "canceled") {
      updateData.canceledAt = new Date();
    }

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order status",
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
    const { vendorId, isAdmin } = await getVendorIdForUser();
    
    // Get order to check ownership
    const orderData = await db
      .select({ vendorId: orders.vendorId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    // Check permissions: admin can delete any order
    // Vendors can only delete orders that contain ONLY their products
    if (!isAdmin && vendorId) {
      // Check if order has items from other vendors
      const orderItemsWithVendors = await db
        .select({ vendorId: listing.vendorId })
        .from(orderItems)
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(eq(orderItems.orderId, orderId));

      const uniqueVendorIds = [...new Set(orderItemsWithVendors.map(item => item.vendorId).filter((id): id is string => id !== null))];
      
      // Vendor can only delete if order contains ONLY their products
      // (This works regardless of orders.vendorId - admin orders with only this vendor's products can be deleted)
      if (uniqueVendorIds.length > 1 || (uniqueVendorIds.length === 1 && uniqueVendorIds[0] !== vendorId)) {
        return { 
          success: false, 
          error: "You cannot delete this order because it contains items from other vendors" 
        };
      }
      // Note: We don't check orders.vendorId here - we only care about the items in the order
    }

    // Get order status and items before deleting to release inventory if needed
    const orderInfo = await db
      .select({ 
        status: orders.status,
        vendorId: orders.vendorId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderInfo.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const orderStatus = orderInfo[0].status;
    const orderVendorId = orderInfo[0].vendorId;

    // Get order items for inventory release
    const items = await db
      .select({
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Release inventory if order status was "open" (inventory was reserved)
    if (orderStatus === "open" && orderVendorId) {
      const inventoryResult = await adjustInventoryForOrder(
        items.map((item) => ({
          variantId: item.variantId || null,
          quantity: item.quantity,
        })),
        orderVendorId,
        "release",
        "order_deleted"
      );

      if (!inventoryResult.success) {
        return { success: false, error: inventoryResult.error || "Failed to release inventory" };
      }
    }

    // Delete order (cascade will handle orderItems, orderPayments, fulfillments)
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
export async function getOrderWithItems(
  orderId: string
): Promise<{
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

    const { vendorId, isAdmin } = await getVendorIdForUser();

    // Validate orderId format (should be a valid UUID)
    if (!orderId || typeof orderId !== "string" || orderId.length !== 36) {
      return { success: false, error: "Invalid order ID" };
    }

    // Get order
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
        vendorId: orders.vendorId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions
    if (!isAdmin && order.vendorId !== vendorId) {
      return {
        success: false,
        error: "You don't have permission to view this order",
      };
    }

    // Get order items with images from listing/variant
    // For vendors, only show items that belong to their listings
    const itemConditions: Array<ReturnType<typeof eq>> = [eq(orderItems.orderId, orderId)];
    
    if (!isAdmin && vendorId) {
      // Filter items to only show those from this vendor's listings
      itemConditions.push(eq(listing.vendorId, vendorId));
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
      },
    };
  } catch (error) {
    console.error("Error fetching order with items:", error);
    // Handle database errors gracefully
    if (error instanceof Error) {
      // Check if it's a database query error
      if (error.message.includes("Failed query") || error.message.includes("invalid input syntax")) {
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

    const { vendorId, isAdmin } = await getVendorIdForUser();

    // Get orders to check permissions
    const ordersData = await db
      .select({ id: orders.id, vendorId: orders.vendorId })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    // Filter orders based on permissions
    let ordersToDelete: string[];
    
    if (isAdmin) {
      // Admin can delete any order
      ordersToDelete = ordersData.map((o) => o.id);
    } else if (vendorId) {
      // Vendors can only delete orders that contain ONLY their products
      const ordersWithItems = await db
        .select({
          orderId: orderItems.orderId,
          vendorId: listing.vendorId,
        })
        .from(orderItems)
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(inArray(orderItems.orderId, orderIds));

      // Group by orderId and check if each order has items from only this vendor
      const orderVendorMap = new Map<string, Set<string>>();
      ordersWithItems.forEach((item) => {
        if (item.vendorId) {
          const current = orderVendorMap.get(item.orderId) || new Set();
          current.add(item.vendorId);
          orderVendorMap.set(item.orderId, current);
        }
      });

      // Filter orders: only include if they have items from only this vendor (or no items)
      ordersToDelete = ordersData
        .filter((order) => {
          const vendorsInOrder = orderVendorMap.get(order.id);
          // Allow if: no items, or only this vendor's items
          // Don't check order.vendorId - we only care about the items
          return (
            (!vendorsInOrder || vendorsInOrder.size === 0) ||
            (vendorsInOrder.size === 1 && vendorsInOrder.has(vendorId))
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
        vendorId: orders.vendorId,
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

      // Get vendor for each listing to properly group items by vendor
      const listingIds = [...new Set(allItems.map((item) => item.listingId))];
      const listingsWithVendors = await db
        .select({
          id: listing.id,
          vendorId: listing.vendorId,
        })
        .from(listing)
        .where(inArray(listing.id, listingIds));

      const listingVendorMap = new Map(
        listingsWithVendors.map((l) => [l.id, l.vendorId])
      );

      // Group items by vendor (using listing vendor, not order vendor)
      const itemsByVendor = new Map<string, Array<{ variantId: string | null; quantity: number }>>();
      
      for (const item of allItems) {
        const vendorId = listingVendorMap.get(item.listingId);
        if (!vendorId) continue;
        
        const existing = itemsByVendor.get(vendorId) || [];
        itemsByVendor.set(vendorId, [
          ...existing,
          {
            variantId: item.variantId || null,
            quantity: item.quantity,
          },
        ]);
      }

      // Release inventory for each vendor
      for (const [vendorId, items] of itemsByVendor.entries()) {
        const inventoryResult = await adjustInventoryForOrder(
          items,
          vendorId,
          "release",
          "order_deleted"
        );

        if (!inventoryResult.success) {
          console.error(`Failed to release inventory for vendor ${vendorId}:`, inventoryResult.error);
          // Continue with deletion even if inventory release fails
        }
      }
    }

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
  searchBy: "all" | "product_title" | "product_id" | "sku" | "variant_title" | "variant_id" = "all",
  page: number = 1,
  pageSize: number = 20
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
    const { vendorId, isAdmin, error: vendorError } = await getVendorIdForUser();

    if (vendorError) {
      return { success: false, error: vendorError };
    }

    // Build query conditions
    // Include both "active" and "draft" listings (draft is default status)
    // Don't filter by status - show all listings that aren't archived
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof or>> = [
      or(
        eq(listing.status, "active"),
        eq(listing.status, "draft")
      )
    ];

    // Filter by vendor if not admin
    if (!isAdmin && vendorId) {
      conditions.push(eq(listing.vendorId, vendorId));
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
        conditions.push(sql`CAST(${listing.id} AS TEXT) ILIKE ${searchPattern}`);
      } else if (searchBy === "sku") {
        conditions.push(like(listingVariants.sku, searchPattern));
      } else if (searchBy === "variant_title") {
        conditions.push(like(listingVariants.title, searchPattern));
      } else if (searchBy === "variant_id") {
        conditions.push(sql`CAST(${listingVariants.id} AS TEXT) ILIKE ${searchPattern}`);
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
    const inventoryTotals = variantIds.length > 0
      ? await db
          .select({
            variantId: inventoryItems.variantId,
            totalAvailable: sql<number>`COALESCE(SUM(${inventoryLevels.available})::int, 0)`.as("total_available"),
          })
          .from(inventoryItems)
          .leftJoin(inventoryLevels, eq(inventoryLevels.inventoryItemId, inventoryItems.id))
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
      error: error instanceof Error ? error.message : "Failed to search products",
    };
  }
}

