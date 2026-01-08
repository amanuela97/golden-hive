"use server";

import { db } from "@/db";
import {
  refundRequests,
  orders,
  orderItems,
  listing,
  store,
} from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStoreIdForUser } from "./orders";

export type RefundRequestRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  reason: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  totalAmount: string;
  currency: string;
  storeId: string | null;
  storeName: string | null;
};

export async function listRefundRequests(): Promise<{
  success: boolean;
  data?: RefundRequestRow[];
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

    // Build where conditions
    const conditions = [];

    // Sellers only see refund requests for their orders
    if (!isAdmin && storeId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 
          FROM ${orders} o
          INNER JOIN ${orderItems} oi ON o.id = oi.order_id
          INNER JOIN ${listing} l ON oi.listing_id = l.id
          WHERE o.id = ${refundRequests.orderId}
          AND l.store_id = ${storeId}
        )`
      );
    }

    // Get refund requests with order and customer info
    const requests = await db
      .select({
        id: refundRequests.id,
        orderId: refundRequests.orderId,
        reason: refundRequests.reason,
        description: refundRequests.description,
        status: refundRequests.status,
        createdAt: refundRequests.createdAt,
        reviewedAt: refundRequests.reviewedAt,
        reviewedBy: refundRequests.reviewedBy,
        rejectionReason: refundRequests.rejectionReason,
        orderNumber: orders.orderNumber,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        storeId: orders.storeId,
      })
      .from(refundRequests)
      .innerJoin(orders, eq(refundRequests.orderId, orders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(refundRequests.createdAt));

    // Get store names for orders
    const storeIds = [
      ...new Set(
        requests.map((r) => r.storeId).filter((id): id is string => id !== null)
      ),
    ];

    const stores =
      storeIds.length > 0
        ? await db
            .select({
              id: store.id,
              storeName: store.storeName,
            })
            .from(store)
            .where(inArray(store.id, storeIds))
        : [];

    const storeMap = new Map(stores.map((s) => [s.id, s.storeName]));

    // Format results
    const data: RefundRequestRow[] = requests.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      customerId: null, // Not needed for seller view
      customerEmail: r.customerEmail,
      customerName:
        r.customerFirstName && r.customerLastName
          ? `${r.customerFirstName} ${r.customerLastName}`
          : r.customerEmail || "Customer",
      reason: r.reason,
      description: r.description,
      status: r.status as "pending" | "approved" | "rejected",
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
      rejectionReason: r.rejectionReason,
      totalAmount: r.totalAmount,
      currency: r.currency,
      storeId: r.storeId,
      storeName: r.storeId ? storeMap.get(r.storeId) || null : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error listing refund requests:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to list refund requests",
    };
  }
}
