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
import { eq, and, sql, like, or, desc, asc, inArray } from "drizzle-orm";
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
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (!isAdmin && vendorId) {
      conditions.push(eq(orders.vendorId, vendorId));
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
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      )
      .groupBy(orders.id);

    const countResult = await countQuery;
    const totalCount = countResult.length;

    // Build sort
    const sortBy = filters.sortBy || "orderNumber";
    const sortDirection = filters.sortDirection || "desc";
    const sortColumn =
      sortBy === "orderNumber"
        ? orders.orderNumber
        : sortBy === "date"
        ? orders.placedAt || orders.createdAt
        : sortBy === "total"
        ? orders.totalAmount
        : sortBy === "paymentStatus"
        ? orders.paymentStatus
        : sortBy === "fulfillmentStatus"
        ? orders.fulfillmentStatus
        : orders.orderNumber;

    const orderBy =
      sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated data
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

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
        itemsCount: sql<number>`COUNT(${orderItems.id})::int`,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      )
      .groupBy(orders.id)
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

    // Use provided vendorId or get from user
    const finalVendorId = vendorId;
    if (isAdmin && !finalVendorId) {
      // For admin creating orders, we might need vendorId in input
      // For now, we'll require it or use the first available vendor
      // This is a simplification - in production you'd want better handling
      return { success: false, error: "Vendor ID required for order creation" };
    }

    return await db.transaction(async (tx) => {
      // Handle customer creation/finding according to edge case logic
      let customerId = input.customerId;

      if (!customerId && input.customerEmail) {
        // Check if customer exists by email
        const existingCustomer = await tx
          .select({ id: customers.id, userId: customers.userId })
          .from(customers)
          .where(eq(customers.email, input.customerEmail))
          .limit(1);

        if (existingCustomer.length > 0) {
          // Edge Case: Email exists - use existing customerId
          // DO NOT update the customer record
          // Order snapshot will use the typed values
          customerId = existingCustomer[0].id;
        } else {
          // Email does not exist - create new customer from typed fields
          const newCustomer = await tx
            .insert(customers)
            .values({
              vendorId: finalVendorId,
              email: input.customerEmail,
              firstName: input.customerFirstName || null,
              lastName: input.customerLastName || null,
              phone: input.customerPhone || null,
            })
            .returning();

          customerId = newCustomer[0].id;
        }
      }

      // Create order
      const orderStatus = input.status || "open";
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

