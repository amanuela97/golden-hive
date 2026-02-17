"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  orderPayments,
  listing,
  store,
  refundRequests,
} from "@/db/schema";
import { eq, and, or, sql, inArray, asc, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStoreIdForUser } from "./store-id";

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

/**
 * List orders with filters and pagination (slim module for orders list page).
 */
export async function listOrders(filters: OrderFilters = {}): Promise<{
  success: boolean;
  data?: OrderRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const {
      storeId,
      isAdmin,
      isCustomer,
      allCustomerIds,
      error: storeError,
    } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [];

    if (isCustomer && allCustomerIds.length > 0) {
      conditions.push(inArray(orders.customerId, allCustomerIds));
    } else if (isCustomer) {
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.user?.email) {
        conditions.push(eq(orders.customerEmail, session.user.email));
      } else {
        return { success: true, data: [], totalCount: 0 };
      }
    }

    if (!isAdmin && !isCustomer && storeId) {
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
          filters.paymentStatus as OrderRow["paymentStatus"]
        )
      );
    }

    if (filters.fulfillmentStatus && filters.fulfillmentStatus !== "all") {
      conditions.push(
        eq(
          orders.fulfillmentStatus,
          filters.fulfillmentStatus as OrderRow["fulfillmentStatus"]
        )
      );
    }

    if (filters.status && filters.status !== "all") {
      conditions.push(
        eq(orders.status, filters.status as OrderRow["status"])
      );
    }

    if (filters.archived !== undefined) {
      if (filters.archived) {
        conditions.push(sql`${orders.archivedAt} IS NOT NULL`);
      } else {
        conditions.push(sql`${orders.archivedAt} IS NULL`);
      }
    }

    let searchCondition: ReturnType<typeof or> | undefined;
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

    const whereClause =
      conditions.length > 0
        ? searchCondition
          ? and(...conditions, searchCondition)
          : and(...conditions)
        : searchCondition || undefined;

    let totalCount: number;

    if (isAdmin) {
      const sessionQuery = db
        .selectDistinct({
          sessionId: orderPayments.stripeCheckoutSessionId,
          orderId: orders.id,
        })
        .from(orders)
        .leftJoin(orderPayments, eq(orders.id, orderPayments.orderId))
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .leftJoin(listing, eq(orderItems.listingId, listing.id))
        .where(whereClause);

      const sessionResult = await sessionQuery;
      const uniqueSessions = new Set<string>();
      for (const row of sessionResult) {
        const key = row.sessionId || row.orderId;
        if (key) uniqueSessions.add(key);
      }
      totalCount = uniqueSessions.size;
    } else {
      const countResult = await db
        .selectDistinct({ id: orders.id })
        .from(orders)
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .leftJoin(listing, eq(orderItems.listingId, listing.id))
        .leftJoin(store, eq(orders.storeId, store.id))
        .where(whereClause);
      totalCount = countResult.length;
    }

    const sortBy = filters.sortBy || "date";
    const sortDirection = filters.sortDirection || "desc";
    const sortColumn =
      sortBy === "orderNumber"
        ? orders.orderNumber
        : sortBy === "date"
          ? sql`COALESCE(${orders.placedAt}, ${orders.createdAt})`
          : sortBy === "total"
            ? orders.totalAmount
            : sortBy === "paymentStatus"
              ? orders.paymentStatus
              : sortBy === "fulfillmentStatus"
                ? orders.fulfillmentStatus
                : sql`COALESCE(${orders.placedAt}, ${orders.createdAt})`;

    const orderBy =
      sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let itemsCountExpression: ReturnType<typeof sql<number>>;
    if (!isAdmin && !isCustomer && storeId) {
      itemsCountExpression = sql<number>`COUNT(CASE WHEN ${listing.storeId} = ${storeId} THEN ${orderItems.id} END)::int`;
    } else {
      itemsCountExpression = sql<number>`COUNT(${orderItems.id})::int`;
    }

    let data: OrderRow[];

    if (isAdmin) {
      const ordersWithSessions = await db
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
          workflowStatus: orders.workflowStatus,
          holdReason: orders.holdReason,
          status: orders.status,
          placedAt: orders.placedAt,
          createdAt: orders.createdAt,
          shippingMethod: orders.shippingMethod,
          archivedAt: orders.archivedAt,
          shippingAddressLine1: orders.shippingAddressLine1,
          shippingCity: orders.shippingCity,
          shippingCountry: orders.shippingCountry,
          refundRequestStatus: orders.refundRequestStatus,
          refundRequestReason: refundRequests.rejectionReason,
          storeName: store.storeName,
          sessionId: orderPayments.stripeCheckoutSessionId,
        })
        .from(orders)
        .leftJoin(orderPayments, eq(orders.id, orderPayments.orderId))
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .leftJoin(listing, eq(orderItems.listingId, listing.id))
        .leftJoin(store, eq(orders.storeId, store.id))
        .leftJoin(
          refundRequests,
          and(
            eq(refundRequests.orderId, orders.id),
            eq(refundRequests.status, "rejected")
          )
        )
        .where(whereClause)
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
          orders.workflowStatus,
          orders.holdReason,
          orders.status,
          orders.placedAt,
          orders.createdAt,
          orders.shippingMethod,
          orders.archivedAt,
          orders.shippingAddressLine1,
          orders.shippingCity,
          orders.shippingCountry,
          orders.refundRequestStatus,
          refundRequests.rejectionReason,
          store.storeName,
          orderPayments.stripeCheckoutSessionId
        );

      const orderIds = [...new Set(ordersWithSessions.map((o) => o.id))];
      const itemCounts = await db
        .select({
          orderId: orderItems.orderId,
          count: sql<number>`COUNT(${orderItems.id})::int`,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .groupBy(orderItems.orderId);

      const itemCountMap = new Map(
        itemCounts.map((ic) => [ic.orderId, ic.count])
      );

      const groupedOrders = new Map<string, typeof ordersWithSessions>();
      for (const order of ordersWithSessions) {
        const groupKey = order.sessionId || order.id;
        if (!groupedOrders.has(groupKey)) {
          groupedOrders.set(groupKey, []);
        }
        groupedOrders.get(groupKey)!.push(order);
      }

      data = Array.from(groupedOrders.values()).map((orderGroup) => {
        const primaryOrder = orderGroup.sort(
          (a, b) =>
            (b.placedAt?.getTime() || b.createdAt.getTime()) -
            (a.placedAt?.getTime() || a.createdAt.getTime())
        )[0];

        const totalAmount = orderGroup.reduce(
          (sum, o) => sum + parseFloat(o.totalAmount || "0"),
          0
        );
        const totalItems = orderGroup.reduce(
          (sum, o) => sum + (itemCountMap.get(o.id) || 0),
          0
        );

        const statuses = orderGroup.map((o) => o.status);
        const paymentStatuses = orderGroup.map((o) => o.paymentStatus);
        const fulfillmentStatuses = orderGroup.map((o) => o.fulfillmentStatus);

        const overallStatus = statuses.includes("canceled")
          ? "canceled"
          : statuses.includes("archived")
            ? "archived"
            : "open";
        const overallPaymentStatus = paymentStatuses.includes("paid")
          ? "paid"
          : paymentStatuses.includes("failed")
            ? "failed"
            : paymentStatuses.includes("refunded")
              ? "refunded"
              : "pending";
        const overallFulfillmentStatus = fulfillmentStatuses.every(
          (s) => s === "fulfilled"
        )
          ? "fulfilled"
          : fulfillmentStatuses.some(
                (s) => s === "fulfilled" || s === "partial"
              )
            ? "partial"
            : "unfulfilled";

        return {
          ...primaryOrder,
          id: primaryOrder.id,
          orderNumber: primaryOrder.orderNumber,
          totalAmount: totalAmount.toFixed(2),
          itemsCount: totalItems,
          paymentStatus: overallPaymentStatus,
          fulfillmentStatus: overallFulfillmentStatus,
          status: overallStatus,
          storeName: primaryOrder.storeName,
          refundRequestReason: primaryOrder.refundRequestReason,
        };
      });

      data.sort((a, b) => {
        const aDate = a.placedAt?.getTime() || a.createdAt.getTime();
        const bDate = b.placedAt?.getTime() || b.createdAt.getTime();
        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      });

      data = data.slice(offset, offset + pageSize);
    } else {
      data = await db
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
          workflowStatus: orders.workflowStatus,
          holdReason: orders.holdReason,
          status: orders.status,
          placedAt: orders.placedAt,
          createdAt: orders.createdAt,
          shippingMethod: orders.shippingMethod,
          archivedAt: orders.archivedAt,
          shippingAddressLine1: orders.shippingAddressLine1,
          shippingCity: orders.shippingCity,
          shippingCountry: orders.shippingCountry,
          refundRequestStatus: orders.refundRequestStatus,
          refundRequestReason: refundRequests.rejectionReason,
          storeName: store.storeName,
          itemsCount: itemsCountExpression,
        })
        .from(orders)
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .leftJoin(listing, eq(orderItems.listingId, listing.id))
        .leftJoin(store, eq(orders.storeId, store.id))
        .leftJoin(
          refundRequests,
          and(
            eq(refundRequests.orderId, orders.id),
            eq(refundRequests.status, "rejected")
          )
        )
        .where(whereClause)
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
          orders.workflowStatus,
          orders.holdReason,
          orders.status,
          orders.placedAt,
          orders.createdAt,
          orders.shippingMethod,
          orders.archivedAt,
          orders.shippingAddressLine1,
          orders.shippingCity,
          orders.shippingCountry,
          orders.refundRequestStatus,
          refundRequests.rejectionReason,
          store.storeName
        )
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset);
    }

    return {
      success: true,
      data: data.map((row) => {
        const shippingAddressLine1 = (
          row as unknown as { shippingAddressLine1?: string | null }
        ).shippingAddressLine1;
        const shippingCity = (
          row as unknown as { shippingCity?: string | null }
        ).shippingCity;
        const shippingCountry = (
          row as unknown as { shippingCountry?: string | null }
        ).shippingCountry;
        const hasAddressWarning =
          !shippingAddressLine1 || !shippingCity || !shippingCountry;
        const hasRiskWarning = false;

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
