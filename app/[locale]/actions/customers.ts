"use server";

import { db } from "@/db";
import {
  customers,
  orders,
  orderItems,
  listing,
  vendor,
  userRoles,
  roles,
} from "@/db/schema";
import { eq, and, sql, like, or, desc, asc, isNull, isNotNull, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type CustomerRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  vendorId: string | null;
  ordersCount: number;
  totalSpent: string;
  lastOrderDate: Date | null;
  createdAt: Date;
};

export type CustomerFilters = {
  search?: string;
  vendorId?: string | null;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/**
 * Get vendor ID and admin status for current user
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

  const isAdmin = userRole.some((r) => r.roleName === "Admin");

  // Get vendor ID if not admin
  let vendorId: string | null = null;
  if (!isAdmin) {
    const vendorData = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session.user.id))
      .limit(1);

    if (vendorData.length > 0) {
      vendorId = vendorData[0].id;
    }
  }

  return { vendorId, isAdmin };
}

/**
 * List customers with search, filters, sort, and pagination
 */
export async function listCustomers(
  filters: CustomerFilters = {}
): Promise<{
  success: boolean;
  data?: CustomerRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin } = await getVendorIdForUser();

    if (!isAdmin && !vendorId) {
      return { success: false, error: "Vendor not found" };
    }

    const page = filters.page || 0;
    const pageSize = filters.pageSize || 20;

    // Build where conditions
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof or> | ReturnType<typeof sql>> = [];

    // Vendor isolation: vendors see customers who have orders with their products
    // This includes customers created by admins (vendorId = null) who ordered from this vendor
    if (!isAdmin && vendorId) {
      // Show customers who either:
      // 1. Have vendorId = currentVendorId (explicitly assigned to this vendor)
      // 2. Have orders with items from this vendor's listings (even if customer.vendorId is null or different)
      // We'll handle this in the join and where clause
      conditions.push(
        or(
          eq(customers.vendorId, vendorId),
          // Customer has orders with items from this vendor's listings
          sql`EXISTS (
            SELECT 1 
            FROM ${orders} o
            INNER JOIN ${orderItems} oi ON o.id = oi.order_id
            INNER JOIN ${listing} l ON oi.listing_id = l.id
            WHERE o.customer_id = ${customers.id}
            AND l.vendor_id = ${vendorId}
          )`
        )
      );
    }

    // Admin vendor filter
    if (isAdmin && filters.vendorId) {
      if (filters.vendorId === "null") {
        conditions.push(isNull(customers.vendorId));
      } else {
        conditions.push(eq(customers.vendorId, filters.vendorId));
      }
    }

    // Search condition
    let searchCondition: ReturnType<typeof or> | null = null;
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      searchCondition = or(
        like(customers.firstName, searchTerm),
        like(customers.lastName, searchTerm),
        like(customers.email, searchTerm),
        like(customers.phone, searchTerm)
      );
    }

    // Combine conditions
    const whereClause =
      conditions.length > 0
        ? searchCondition
          ? and(...conditions, searchCondition)
          : and(...conditions)
        : searchCondition || undefined;

    // Determine sort
    let orderBy;
    const sortDirection = filters.sortDirection === "desc" ? desc : asc;
    switch (filters.sortBy) {
      case "newest":
        orderBy = sortDirection(customers.createdAt);
        break;
      case "oldest":
        orderBy = sortDirection(customers.createdAt);
        break;
      case "total_spent":
        orderBy = sortDirection(sql`total_spent`);
        break;
      case "orders_count":
        orderBy = sortDirection(sql`orders_count`);
        break;
      case "name_asc":
        orderBy = asc(customers.firstName, customers.lastName);
        break;
      case "name_desc":
        orderBy = desc(customers.firstName, customers.lastName);
        break;
      default:
        orderBy = desc(customers.createdAt);
    }

    // For vendors, we need to filter orders to only count orders with their products
    // For admins, count all orders
    let ordersJoinCondition = eq(customers.id, orders.customerId);
    if (!isAdmin && vendorId) {
      // Only count orders that have items from this vendor's listings
      ordersJoinCondition = and(
        eq(customers.id, orders.customerId),
        sql`EXISTS (
          SELECT 1 
          FROM ${orderItems} oi
          INNER JOIN ${listing} l ON oi.listing_id = l.id
          WHERE oi.order_id = ${orders.id}
          AND l.vendor_id = ${vendorId}
        )`
      );
    }

    // Get total count
    const countResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${customers.id})::int`,
      })
      .from(customers)
      .leftJoin(orders, ordersJoinCondition)
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    // Get customers with aggregated data
    // For vendors, only aggregate orders that have items from their listings
    const customersData = await db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
        vendorId: customers.vendorId,
        createdAt: customers.createdAt,
        ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})::int`,
        totalSpent: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)::text`,
        lastOrderDate: sql<Date | null>`MAX(${orders.createdAt})`,
      })
      .from(customers)
      .leftJoin(orders, ordersJoinCondition)
      .where(whereClause)
      .groupBy(customers.id)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(page * pageSize);

    return {
      success: true,
      data: customersData.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        vendorId: row.vendorId,
        ordersCount: row.ordersCount || 0,
        totalSpent: row.totalSpent || "0",
        lastOrderDate: row.lastOrderDate || null,
        createdAt: row.createdAt,
      })),
      totalCount,
    };
  } catch (error) {
    console.error("Error listing customers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list customers",
    };
  }
}

/**
 * Get customer by ID with detailed stats
 */
export async function getCustomer(
  customerId: string
): Promise<{
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
    notes: string | null;
    vendorId: string | null;
    createdAt: Date;
    updatedAt: Date;
    stats: {
      totalSpent: string;
      totalOrders: number;
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
      averageOrderValue: string;
    };
  };
  error?: string;
}> {
  try {
    const { vendorId, isAdmin } = await getVendorIdForUser();

    // Get customer
    const customerData = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    const customer = customerData[0];

    // Check permissions
    // Vendors can view customers who:
    // 1. Have vendorId matching their vendorId, OR
    // 2. Have orders with items from their listings (even if customer.vendorId is null)
    if (!isAdmin && vendorId) {
      if (customer.vendorId !== vendorId) {
        // Check if customer has orders with items from this vendor's listings
        const hasVendorOrders = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .innerJoin(listing, eq(orderItems.listingId, listing.id))
          .where(
            and(
              eq(orders.customerId, customerId),
              eq(listing.vendorId, vendorId)
            )
          )
          .limit(1);

        if (!hasVendorOrders[0] || hasVendorOrders[0].count === 0) {
          return {
            success: false,
            error: "You don't have permission to view this customer",
          };
        }
      }
    }

    // Get order stats
    // When there are no orders, this will return an empty array, so we handle that case
    const orderStats = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)::text`,
        totalOrders: sql<number>`COUNT(${orders.id})::int`,
        firstOrderDate: sql<Date | null>`MIN(${orders.createdAt})`,
        lastOrderDate: sql<Date | null>`MAX(${orders.createdAt})`,
        averageOrderValue: sql<string>`COALESCE(AVG(${orders.totalAmount}), 0)::text`,
      })
      .from(orders)
      .where(eq(orders.customerId, customerId));

    const stats = orderStats[0] || {
      totalSpent: "0",
      totalOrders: 0,
      firstOrderDate: null,
      lastOrderDate: null,
      averageOrderValue: "0",
    };

    return {
      success: true,
      data: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        region: customer.region,
        postalCode: customer.postalCode,
        country: customer.country,
        notes: customer.notes,
        vendorId: customer.vendorId,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        stats: {
          totalSpent: stats.totalSpent,
          totalOrders: stats.totalOrders,
          firstOrderDate: stats.firstOrderDate,
          lastOrderDate: stats.lastOrderDate,
          averageOrderValue: stats.averageOrderValue,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch customer",
    };
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  vendorId?: string | null; // Admin can set this, vendors use their own
}): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const { vendorId: currentVendorId, isAdmin } = await getVendorIdForUser();

    if (!isAdmin && !currentVendorId) {
      return { success: false, error: "Vendor not found" };
    }

    // Determine vendorId
    let finalVendorId: string | null = null;
    if (isAdmin) {
      // Admin can set vendorId or leave it null (global customer)
      finalVendorId = input.vendorId || null;
    } else {
      // Vendor always uses their own vendorId
      finalVendorId = currentVendorId;
    }

    // Check for duplicate email within same vendor
    const existingCustomer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.email, input.email),
          finalVendorId ? eq(customers.vendorId, finalVendorId) : isNull(customers.vendorId)
        )
      )
      .limit(1);

    if (existingCustomer.length > 0) {
      return {
        success: false,
        error: "Customer with this email already exists for your store",
      };
    }

    // Create customer
    const newCustomer = await db
      .insert(customers)
      .values({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        country: input.country,
        notes: input.notes,
        vendorId: finalVendorId,
      })
      .returning({ id: customers.id });

    return {
      success: true,
      data: { id: newCustomer[0].id },
    };
  } catch (error) {
    console.error("Error creating customer:", error);
    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes("unique")) {
      return {
        success: false,
        error: "Customer with this email already exists for your store",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}

/**
 * Update customer
 */
export async function updateCustomer(
  customerId: string,
  input: {
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    notes?: string | null;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin } = await getVendorIdForUser();

    // Get customer to check permissions
    const customerData = await db
      .select({ vendorId: customers.vendorId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    // Check permissions
    if (!isAdmin && customerData[0].vendorId !== vendorId) {
      return {
        success: false,
        error: "You don't have permission to edit this customer",
      };
    }

    // Check for duplicate email if email is being changed
    if (input.email) {
      const existingCustomer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.email, input.email),
            ne(customers.id, customerId),
            customerData[0].vendorId
              ? eq(customers.vendorId, customerData[0].vendorId)
              : isNull(customers.vendorId)
          )
        )
        .limit(1);

      if (existingCustomer.length > 0) {
        return {
          success: false,
          error: "Customer with this email already exists for your store",
        };
      }
    }

    // Update customer
    await db
      .update(customers)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    return { success: true };
  } catch (error) {
    console.error("Error updating customer:", error);
    if (error instanceof Error && error.message.includes("unique")) {
      return {
        success: false,
        error: "Customer with this email already exists for your store",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer",
    };
  }
}

/**
 * Delete customer (admin only)
 */
export async function deleteCustomer(
  customerId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { isAdmin } = await getVendorIdForUser();

    if (!isAdmin) {
      return { success: false, error: "Only admins can delete customers" };
    }

    // Check if customer exists
    const customerData = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    // Delete customer (cascade will handle orders)
    await db.delete(customers).where(eq(customers.id, customerId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete customer",
    };
  }
}

/**
 * Search customers (for order creation)
 */
export async function searchCustomers(query: string): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }>;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin } = await getVendorIdForUser();

    if (!isAdmin && !vendorId) {
      return { success: false, error: "Vendor not found" };
    }

    const searchTerm = `%${query}%`;

    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof or>> = [];

    // Vendor isolation
    if (!isAdmin && vendorId) {
      conditions.push(eq(customers.vendorId, vendorId));
    }

    const searchCondition = or(
      like(customers.firstName, searchTerm),
      like(customers.lastName, searchTerm),
      like(customers.email, searchTerm),
      like(customers.phone, searchTerm)
    );

    const whereClause =
      conditions.length > 0
        ? and(...conditions, searchCondition)
        : searchCondition;

    const results = await db
      .select({
        id: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        phone: customers.phone,
      })
      .from(customers)
      .where(whereClause)
      .limit(20);

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error("Error searching customers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search customers",
    };
  }
}

/**
 * Get orders for a customer
 */
export async function getCustomerOrders(
  customerId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    orderNumber: number;
    totalAmount: string;
    currency: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    status: string;
    createdAt: Date;
    itemsCount: number;
  }>;
  error?: string;
}> {
  try {
    const { vendorId, isAdmin } = await getVendorIdForUser();

    // Get customer to check permissions
    const customerData = await db
      .select({ vendorId: customers.vendorId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    // Check permissions
    // Vendors can view customers who:
    // 1. Have vendorId matching their vendorId, OR
    // 2. Have orders with items from their listings (even if customer.vendorId is null)
    if (!isAdmin && vendorId) {
      if (customerData[0].vendorId !== vendorId) {
        // Check if customer has orders with items from this vendor's listings
        const hasVendorOrders = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .innerJoin(listing, eq(orderItems.listingId, listing.id))
          .where(
            and(
              eq(orders.customerId, customerId),
              eq(listing.vendorId, vendorId)
            )
          )
          .limit(1);

        if (!hasVendorOrders[0] || hasVendorOrders[0].count === 0) {
          return {
            success: false,
            error: "You don't have permission to view this customer's orders",
          };
        }
      }
    }

    // Get orders
    const ordersData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        status: orders.status,
        createdAt: orders.createdAt,
        itemsCount: sql<number>`COUNT(${orderItems.id})::int`,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(eq(orders.customerId, customerId))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt));

    return {
      success: true,
      data: ordersData.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        status: order.status,
        createdAt: order.createdAt,
        itemsCount: order.itemsCount,
      })),
    };
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch customer orders",
    };
  }
}

/**
 * Get all vendors (for admin filter dropdown)
 */
export async function getVendorsForFilter(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  try {
    const { isAdmin } = await getVendorIdForUser();

    if (!isAdmin) {
      return { success: false, error: "Only admins can view vendors" };
    }

    const vendors = await db
      .select({
        id: vendor.id,
        name: vendor.storeName,
      })
      .from(vendor)
      .orderBy(asc(vendor.storeName));

    return {
      success: true,
      data: vendors,
    };
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch vendors",
    };
  }
}

