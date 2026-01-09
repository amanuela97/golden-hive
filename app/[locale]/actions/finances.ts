"use server";

import { db } from "@/db";
import {
  sellerBalances,
  sellerBalanceTransactions,
  sellerPayoutSettings,
} from "@/db/schema";
import { eq, desc, and, or, gte, lte, ilike, sql } from "drizzle-orm";
import { getStoreIdForUser } from "./orders";
import { revalidatePath } from "next/cache";
import type { InferSelectModel } from "drizzle-orm";

type BalanceTransactionType = InferSelectModel<
  typeof sellerBalanceTransactions
>["type"];

/**
 * Get comprehensive balance summary with available, pending, and amount due
 */
export async function getBalanceSummary() {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  const [balance] = await db
    .select()
    .from(sellerBalances)
    .where(eq(sellerBalances.storeId, storeId))
    .limit(1);

  if (!balance) {
    return {
      success: true,
      data: {
        availableBalance: 0,
        pendingBalance: 0,
        amountDue: 0,
        currentBalance: 0,
        currency: "EUR",
        lastPayoutAt: null,
        lastPayoutAmount: null,
      },
    };
  }

  const availableBalance = parseFloat(balance.availableBalance);
  const pendingBalance = parseFloat(balance.pendingBalance);

  // Calculate amount due (negative balances from fees, shipping, etc.)
  // Amount due is when availableBalance is negative
  const amountDue = Math.max(0, -availableBalance);

  return {
    success: true,
    data: {
      availableBalance: Math.max(0, availableBalance), // Only show positive available
      pendingBalance,
      amountDue,
      currentBalance: availableBalance + pendingBalance,
      currency: balance.currency,
      lastPayoutAt: balance.lastPayoutAt,
      lastPayoutAmount: balance.lastPayoutAmount
        ? parseFloat(balance.lastPayoutAmount)
        : null,
    },
  };
}

/**
 * Get recent activity (all transactions with running balance)
 */
export async function getRecentActivity(
  limit = 50,
  offset = 0,
  filters?: {
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }
) {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  // Build conditions array
  const conditions = [eq(sellerBalanceTransactions.storeId, storeId)];

  // Apply filters
  if (filters?.type) {
    conditions.push(
      eq(sellerBalanceTransactions.type, filters.type as BalanceTransactionType)
    );
  }

  if (filters?.dateFrom) {
    conditions.push(gte(sellerBalanceTransactions.createdAt, filters.dateFrom));
  }

  if (filters?.dateTo) {
    // Set to end of day
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(sellerBalanceTransactions.createdAt, endOfDay));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(sellerBalanceTransactions.description, searchTerm),
        sql`CAST(${sellerBalanceTransactions.orderId} AS TEXT) ILIKE ${searchTerm}`
      )!
    );
  }

  const transactions = await db
    .select()
    .from(sellerBalanceTransactions)
    .where(and(...conditions))
    .orderBy(desc(sellerBalanceTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  // Calculate running balance for each transaction
  const activity = transactions.map((t) => {
    const isCredit = t.type === "order_payment";
    const amount = isCredit ? parseFloat(t.amount) : -parseFloat(t.amount);

    return {
      id: t.id,
      date: t.createdAt,
      type: t.type,
      description: t.description || getTransactionDescription(t.type),
      amount,
      currency: t.currency,
      balance: parseFloat(t.balanceAfter),
      orderId: t.orderId,
      metadata: t.metadata,
      status: t.status,
      availableAt: t.availableAt,
    };
  });

  return { success: true, data: activity };
}

/**
 * Export transactions as CSV
 */
export async function exportTransactionsAsCSV(filters?: {
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}) {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  // Build conditions array (same as getRecentActivity)
  const conditions = [eq(sellerBalanceTransactions.storeId, storeId)];

  if (filters?.type) {
    conditions.push(
      eq(sellerBalanceTransactions.type, filters.type as BalanceTransactionType)
    );
  }

  if (filters?.dateFrom) {
    conditions.push(gte(sellerBalanceTransactions.createdAt, filters.dateFrom));
  }

  if (filters?.dateTo) {
    const endOfDay = new Date(filters.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(sellerBalanceTransactions.createdAt, endOfDay));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(sellerBalanceTransactions.description, searchTerm),
        sql`CAST(${sellerBalanceTransactions.orderId} AS TEXT) ILIKE ${searchTerm}`
      )!
    );
  }

  const transactions = await db
    .select()
    .from(sellerBalanceTransactions)
    .where(and(...conditions))
    .orderBy(desc(sellerBalanceTransactions.createdAt));

  // Convert to CSV
  const headers = [
    "Date",
    "Type",
    "Description",
    "Amount",
    "Currency",
    "Balance After",
    "Order ID",
    "Status",
  ];

  const rows = transactions.map((t) => {
    const isCredit = t.type === "order_payment";
    const amount = isCredit ? parseFloat(t.amount) : -parseFloat(t.amount);

    return [
      t.createdAt.toISOString(),
      t.type,
      t.description || getTransactionDescription(t.type),
      amount.toString(),
      t.currency,
      parseFloat(t.balanceAfter).toString(),
      t.orderId || "",
      t.status || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return {
    success: true,
    data: csvContent,
    filename: `transactions-${new Date().toISOString().split("T")[0]}.csv`,
  };
}

function getTransactionDescription(type: string): string {
  const descriptions: Record<string, string> = {
    order_payment: "Sale",
    platform_fee: "Platform commission",
    stripe_fee: "Stripe processing fee",
    shipping_label: "Shipping label cost",
    refund: "Refund",
    dispute: "Dispute/Chargeback",
    payout: "Payout",
    adjustment: "Adjustment",
  };
  return descriptions[type] || type;
}

/**
 * Get payout settings
 */
export async function getPayoutSettings() {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  const [settings] = await db
    .select()
    .from(sellerPayoutSettings)
    .where(eq(sellerPayoutSettings.storeId, storeId))
    .limit(1);

  return {
    success: true,
    data: settings
      ? {
          method: settings.method as "manual" | "automatic",
          schedule: settings.schedule as
            | "weekly"
            | "biweekly"
            | "monthly"
            | null,
          minimumAmount: parseFloat(settings.minimumAmount),
          payoutDayOfWeek: settings.payoutDayOfWeek,
          payoutDayOfMonth: settings.payoutDayOfMonth,
          holdPeriodDays: settings.holdPeriodDays || 7,
          nextPayoutAt: settings.nextPayoutAt || null,
        }
      : {
          method: "manual" as const,
          schedule: null,
          minimumAmount: 20.0,
          payoutDayOfWeek: null,
          payoutDayOfMonth: null,
          holdPeriodDays: 7,
          nextPayoutAt: null,
        },
  };
}

/**
 * Calculate next payout date based on schedule
 */
export async function calculateNextPayoutDate(
  schedule: "weekly" | "biweekly" | "monthly" | null,
  payoutDayOfWeek: number | null,
  payoutDayOfMonth: number | null,
  lastPayoutAt: Date | null
): Promise<Date> {
  const now = new Date();
  const nextDate = new Date(now);

  if (schedule === "weekly" && payoutDayOfWeek !== null) {
    const daysUntilNext = (payoutDayOfWeek - now.getDay() + 7) % 7;
    nextDate.setDate(nextDate.getDate() + (daysUntilNext || 7));
  } else if (schedule === "biweekly") {
    const lastPayout = lastPayoutAt || now;
    const daysSince = Math.floor(
      (now.getTime() - lastPayout.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilNext = 14 - (daysSince % 14);
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
  } else if (schedule === "monthly" && payoutDayOfMonth !== null) {
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(payoutDayOfMonth);
    if (nextDate < now) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  } else {
    // Default to next day if no schedule
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

/**
 * Update payout settings
 */
export async function updatePayoutSettings(params: {
  method: "manual" | "automatic";
  schedule?: "weekly" | "biweekly" | "monthly" | null;
  minimumAmount?: number;
  payoutDayOfWeek?: number | null;
  payoutDayOfMonth?: number | null;
  holdPeriodDays?: number;
}) {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  try {
    const [existing] = await db
      .select()
      .from(sellerPayoutSettings)
      .where(eq(sellerPayoutSettings.storeId, storeId))
      .limit(1);

    // Calculate nextPayoutAt if automatic
    let nextPayoutAt: Date | null = null;
    if (params.method === "automatic" && params.schedule) {
      // Get last payout date from balance
      const [balance] = await db
        .select()
        .from(sellerBalances)
        .where(eq(sellerBalances.storeId, storeId))
        .limit(1);

      nextPayoutAt = await calculateNextPayoutDate(
        params.schedule,
        params.payoutDayOfWeek || null,
        params.payoutDayOfMonth || null,
        balance?.lastPayoutAt || null
      );
    }

    if (existing) {
      await db
        .update(sellerPayoutSettings)
        .set({
          method: params.method,
          schedule: params.schedule || null,
          minimumAmount: params.minimumAmount
            ? params.minimumAmount.toFixed(2)
            : "20.00",
          payoutDayOfWeek: params.payoutDayOfWeek || null,
          payoutDayOfMonth: params.payoutDayOfMonth || null,
          holdPeriodDays: params.holdPeriodDays || existing.holdPeriodDays || 7,
          nextPayoutAt,
          updatedAt: new Date(),
        })
        .where(eq(sellerPayoutSettings.storeId, storeId));
    } else {
      await db.insert(sellerPayoutSettings).values({
        storeId,
        method: params.method,
        schedule: params.schedule || null,
        minimumAmount: params.minimumAmount
          ? params.minimumAmount.toFixed(2)
          : "20.00",
        payoutDayOfWeek: params.payoutDayOfWeek || null,
        payoutDayOfMonth: params.payoutDayOfMonth || null,
        holdPeriodDays: params.holdPeriodDays || 7,
        nextPayoutAt,
      });
    }

    revalidatePath("/dashboard/finances");
    return { success: true };
  } catch (error) {
    console.error("Error updating payout settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
