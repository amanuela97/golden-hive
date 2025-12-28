"use server";

import { db } from "@/db";
import {
  customers,
  orders,
  orderItems,
  listing,
  store,
  storeMembers,
  userRoles,
  roles,
} from "@/db/schema";
import {
  eq,
  and,
  sql,
  like,
  or,
  desc,
  asc,
  isNull,
  isNotNull,
  ne,
  inArray,
} from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type CustomerRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  storeId: string | null;
  ordersCount: number;
  totalSpent: string;
  lastOrderDate: Date | null;
  createdAt: Date;
};

export type CustomerFilters = {
  search?: string;
  storeId?: string | null;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/**
 * Get store ID and admin status for current user
 */
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

  const isAdmin = userRole.some((r) => r.roleName === "Admin");

  // Get store ID if not admin
  let storeId: string | null = null;
  if (!isAdmin) {
    const storeData = await db
      .select({ id: store.id })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, session.user.id))
      .limit(1);

    if (storeData.length > 0) {
      storeId = storeData[0].id;
    }
  }

  return { storeId, isAdmin };
}

/**
 * List customers with search, filters, sort, and pagination
 */
export async function listCustomers(filters: CustomerFilters = {}): Promise<{
  success: boolean;
  data?: CustomerRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const { storeId, isAdmin } = await getStoreIdForUser();

    if (!isAdmin && !storeId) {
      return { success: false, error: "Store not found" };
    }

    const page = filters.page || 0;
    const pageSize = filters.pageSize || 20;

    // Build where conditions
    const conditions: Array<
      ReturnType<typeof eq> | ReturnType<typeof or> | ReturnType<typeof sql>
    > = [];

    // Store isolation: stores see customers who have orders with their products
    // This includes customers created by admins (storeId = null) who ordered from this store
    if (!isAdmin && storeId) {
      // Show customers who either:
      // 1. Have storeId = currentStoreId (explicitly assigned to this store)
      // 2. Have orders with items from this store's listings (even if customer.storeId is null or different)
      // We'll handle this in the join and where clause
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

    // Admin store filter
    if (isAdmin && filters.storeId) {
      if (filters.storeId === "null") {
        conditions.push(isNull(customers.storeId));
      } else {
        conditions.push(eq(customers.storeId, filters.storeId));
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

    // For stores, we need to filter orders to only count orders with their products
    // For admins, count all orders
    let ordersJoinCondition = eq(customers.id, orders.customerId);
    if (!isAdmin && storeId) {
      // Only count orders that have items from this store's listings
      ordersJoinCondition = and(
        eq(customers.id, orders.customerId),
        sql`EXISTS (
          SELECT 1 
          FROM ${orderItems} oi
          INNER JOIN ${listing} l ON oi.listing_id = l.id
          WHERE oi.order_id = ${orders.id}
          AND l.store_id = ${storeId}
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
    // For admins: Group customers by email to show one customer per email
    // For stores: Show individual customers (they only see customers with their products anyway)
    let customersData: any[];

    if (isAdmin) {
      // For admins: Get all customers, then group by email
      const allCustomers = await db
        .select({
          id: customers.id,
          email: customers.email,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          storeId: customers.storeId,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(whereClause);

      // Get orders for all customers
      const customerIds = allCustomers.map((c) => c.id);
      const customerOrders = customerIds.length > 0
        ? await db
            .select({
              customerId: orders.customerId,
              id: orders.id,
              totalAmount: orders.totalAmount,
              createdAt: orders.createdAt,
            })
            .from(orders)
            .where(
              customerIds.length > 0
                ? inArray(orders.customerId, customerIds)
                : undefined
            )
        : [];

      // Group customers by email
      const customersByEmail = new Map<string, typeof allCustomers>();
      for (const customer of allCustomers) {
        const email = customer.email.toLowerCase();
        if (!customersByEmail.has(email)) {
          customersByEmail.set(email, []);
        }
        customersByEmail.get(email)!.push(customer);
      }

      // Aggregate data for each email group
      customersData = Array.from(customersByEmail.entries()).map(
        ([email, customerGroup]) => {
          // Use the most recent customer as the base
          const primaryCustomer = customerGroup.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          )[0];

          // Get all customer IDs in this group
          const groupCustomerIds = customerGroup.map((c) => c.id);

          // Aggregate orders for all customers in this group
          const groupOrders = customerOrders.filter((o) =>
            o.customerId && groupCustomerIds.includes(o.customerId)
          );

          const ordersCount = new Set(groupOrders.map((o) => o.id)).size;
          const totalSpent = groupOrders.reduce(
            (sum, o) => sum + parseFloat(o.totalAmount || "0"),
            0
          );
          const lastOrderDate =
            groupOrders.length > 0
              ? groupOrders.sort(
                  (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
                )[0].createdAt
              : null;

          return {
            id: primaryCustomer.id,
            email: primaryCustomer.email,
            firstName: primaryCustomer.firstName,
            lastName: primaryCustomer.lastName,
            phone: primaryCustomer.phone,
            storeId: null, // For grouped customers, storeId is null (they span multiple stores)
            createdAt: primaryCustomer.createdAt,
            ordersCount,
            totalSpent: totalSpent.toFixed(2),
            lastOrderDate,
            isGrouped: customerGroup.length > 1,
            groupedCustomerIds: customerGroup.map((c) => c.id),
          };
        }
      );

      // Sort the grouped data
      customersData.sort((a, b) => {
        const aDate = a.createdAt.getTime();
        const bDate = b.createdAt.getTime();
        return sortDirection === "desc" ? bDate - aDate : aDate - bDate;
      });

      // Apply pagination
      customersData = customersData.slice(
        page * pageSize,
        (page + 1) * pageSize
      );
    } else {
      // For stores: Show individual customers (existing logic)
      customersData = await db
        .select({
          id: customers.id,
          email: customers.email,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          storeId: customers.storeId,
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
    }

    return {
      success: true,
      data: customersData.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        storeId: row.storeId,
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
      error:
        error instanceof Error ? error.message : "Failed to list customers",
    };
  }
}

/**
 * Get customer by ID with detailed stats
 */
export async function getCustomer(customerId: string): Promise<{
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
    storeId: string | null;
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
    const { storeId, isAdmin } = await getStoreIdForUser();

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
    // Stores can view customers who:
    // 1. Have storeId matching their storeId, OR
    // 2. Have orders with items from their listings (even if customer.storeId is null)
    if (!isAdmin && storeId) {
      if (customer.storeId !== storeId) {
        // Check if customer has orders with items from this store's listings
        const hasStoreOrders = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .innerJoin(listing, eq(orderItems.listingId, listing.id))
          .where(
            and(
              eq(orders.customerId, customerId),
              eq(listing.storeId, storeId)
            )
          )
          .limit(1);

        if (!hasStoreOrders[0] || hasStoreOrders[0].count === 0) {
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
        storeId: customer.storeId,
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
      error:
        error instanceof Error ? error.message : "Failed to fetch customer",
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
  storeId?: string | null; // Admin can set this, stores use their own
}): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const { storeId: currentStoreId, isAdmin } = await getStoreIdForUser();

    if (!isAdmin && !currentStoreId) {
      return { success: false, error: "Store not found" };
    }

    // Determine storeId
    let finalStoreId: string | null = null;
    if (isAdmin) {
      // Admin can set storeId or leave it null (global customer)
      finalStoreId = input.storeId || null;
    } else {
      // Store always uses their own storeId
      finalStoreId = currentStoreId;
    }

    // Check for duplicate email within same store
    const existingCustomer = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.email, input.email),
          finalStoreId
            ? eq(customers.storeId, finalStoreId)
            : isNull(customers.storeId)
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
        storeId: finalStoreId,
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
      error:
        error instanceof Error ? error.message : "Failed to create customer",
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
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get customer to check permissions
    const customerData = await db
      .select({ storeId: customers.storeId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    // Check permissions
    if (!isAdmin && customerData[0].storeId !== storeId) {
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
            customerData[0].storeId
              ? eq(customers.storeId, customerData[0].storeId)
              : isNull(customers.storeId)
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
      error:
        error instanceof Error ? error.message : "Failed to update customer",
    };
  }
}

/**
 * Delete customer (admin only)
 */
export async function deleteCustomer(customerId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { isAdmin } = await getStoreIdForUser();

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
      error:
        error instanceof Error ? error.message : "Failed to delete customer",
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
    const { storeId, isAdmin } = await getStoreIdForUser();

    if (!isAdmin && !storeId) {
      return { success: false, error: "Store not found" };
    }

    const searchTerm = `%${query}%`;

    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof or>> = [];

    // Store isolation
    if (!isAdmin && storeId) {
      conditions.push(eq(customers.storeId, storeId));
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
      error:
        error instanceof Error ? error.message : "Failed to search customers",
    };
  }
}

/**
 * Get orders for a customer
 */
export async function getCustomerOrders(customerId: string): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    orderNumber: string;
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
    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get customer to check permissions
    const customerData = await db
      .select({ storeId: customers.storeId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    // Check permissions
    // Stores can view customers who:
    // 1. Have storeId matching their storeId, OR
    // 2. Have orders with items from their listings (even if customer.storeId is null)
    if (!isAdmin && storeId) {
      if (customerData[0].storeId !== storeId) {
        // Check if customer has orders with items from this store's listings
        const hasStoreOrders = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .innerJoin(listing, eq(orderItems.listingId, listing.id))
          .where(
            and(
              eq(orders.customerId, customerId),
              eq(listing.storeId, storeId)
            )
          )
          .limit(1);

        if (!hasStoreOrders[0] || hasStoreOrders[0].count === 0) {
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch customer orders",
    };
  }
}

/**
 * Get all stores (for admin filter dropdown)
 */
export async function getStoresForFilter(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  try {
    const { isAdmin } = await getStoreIdForUser();

    if (!isAdmin) {
      return { success: false, error: "Only admins can view stores" };
    }

    const stores = await db
      .select({
        id: store.id,
        name: store.storeName,
      })
      .from(store)
      .orderBy(asc(store.storeName));

    return {
      success: true,
      data: stores,
    };
  } catch (error) {
    console.error("Error fetching stores:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch stores",
    };
  }
}
