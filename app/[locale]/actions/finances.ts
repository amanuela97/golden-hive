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

// Type for payout settings that may or may not have optional columns
type PayoutSettingsRow = InferSelectModel<typeof sellerPayoutSettings> & {
  holdPeriodDays?: number | null;
  nextPayoutAt?: Date | null;
};

// Type for raw SQL query result
type PayoutSettingsRawRow = {
  id: string;
  store_id: string;
  method: string;
  schedule: string | null;
  minimum_amount: string;
  payout_day_of_week: number | null;
  payout_day_of_month: number | null;
  hold_period_days: number | null;
  next_payout_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

/**
 * Get comprehensive balance summary with available, pending, and amount due
 * Also checks Stripe balance to ensure we only show funds that are actually available
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
        stripeAvailableBalance: 0,
      },
    };
  }

  const ledgerAvailableBalance = parseFloat(balance.availableBalance);
  const pendingBalance = parseFloat(balance.pendingBalance);

  // Check actual Stripe balance to ensure we only show funds that are available
  let stripeAvailableBalance: number | null = null;
  try {
    const { stripe } = await import("@/lib/stripe");
    const stripeBalance = await stripe.balance.retrieve();

    // Find available balance for the currency
    const currencyBalance = stripeBalance.available.find(
      (b) => b.currency.toLowerCase() === balance.currency.toLowerCase()
    );

    // Convert from cents to dollars/euros
    stripeAvailableBalance = currencyBalance ? currencyBalance.amount / 100 : 0;
  } catch (error) {
    console.error("Error retrieving Stripe balance:", error);
    // If we can't get Stripe balance, set to null to indicate check failed
    // We'll be conservative and use 0 for available balance
    stripeAvailableBalance = null;
  }

  // Available balance is the minimum of ledger balance and Stripe balance
  // This ensures we only show funds that are actually available for payout
  // If Stripe check failed, use 0 to be safe (don't show funds that might not exist)
  const availableBalance =
    stripeAvailableBalance !== null
      ? Math.min(
          Math.max(0, ledgerAvailableBalance),
          Math.max(0, stripeAvailableBalance)
        )
      : 0; // If Stripe check failed, show 0 to prevent incorrect payouts

  // Calculate amount due (negative balances from fees, shipping, etc.)
  // Amount due is when availableBalance is negative
  const amountDue = Math.max(0, -ledgerAvailableBalance);

  return {
    success: true,
    data: {
      availableBalance, // Only show what's actually available in Stripe
      pendingBalance,
      amountDue,
      currentBalance: ledgerAvailableBalance + pendingBalance, // Current balance includes pending
      currency: balance.currency,
      lastPayoutAt: balance.lastPayoutAt,
      lastPayoutAmount: balance.lastPayoutAmount
        ? parseFloat(balance.lastPayoutAmount)
        : null,
      stripeAvailableBalance: stripeAvailableBalance ?? 0, // Include for debugging/transparency
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

  // Query only base columns that definitely exist (from migration 0054)
  // Optional columns (hold_period_days, next_payout_at) from migration 0055 may not exist
  try {
    const result = await db.execute(
      sql`SELECT 
            id, 
            store_id, 
            method, 
            schedule, 
            minimum_amount, 
            payout_day_of_week, 
            payout_day_of_month, 
            created_at, 
            updated_at
          FROM seller_payout_settings 
          WHERE store_id = ${storeId} 
          LIMIT 1`
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as {
        id: string;
        store_id: string;
        method: string;
        schedule: string | null;
        minimum_amount: string;
        payout_day_of_week: number | null;
        payout_day_of_month: number | null;
        created_at: Date | string;
        updated_at: Date | string;
      };

      // Try to get optional columns if they exist (migration 0055)
      let holdPeriodDays = 7;
      let nextPayoutAt: Date | null = null;

      try {
        const optionalResult = await db.execute(
          sql`SELECT 
                hold_period_days,
                next_payout_at
              FROM seller_payout_settings 
              WHERE store_id = ${storeId} 
              LIMIT 1`
        );

        if (optionalResult.rows && optionalResult.rows.length > 0) {
          const optionalRow = optionalResult.rows[0] as {
            hold_period_days?: number | null;
            next_payout_at?: Date | string | null;
          };
          holdPeriodDays = optionalRow.hold_period_days ?? 7;
          nextPayoutAt = optionalRow.next_payout_at
            ? new Date(optionalRow.next_payout_at)
            : null;
        }
      } catch {
        // Optional columns don't exist (migration 0055 hasn't run)
        // Use defaults - this is expected and not an error
      }

      return {
        success: true,
        data: {
          method: row.method as "manual" | "automatic",
          schedule: row.schedule as
            | "daily"
            | "weekly"
            | "biweekly"
            | "monthly"
            | null,
          minimumAmount: parseFloat(row.minimum_amount),
          payoutDayOfWeek: row.payout_day_of_week,
          payoutDayOfMonth: row.payout_day_of_month,
          holdPeriodDays,
          nextPayoutAt,
        },
      };
    }

    // No settings found, return defaults
    return {
      success: true,
      data: {
        method: "manual" as const,
        schedule: null,
        minimumAmount: 20.0,
        payoutDayOfWeek: null,
        payoutDayOfMonth: null,
        holdPeriodDays: 7,
        nextPayoutAt: null,
      },
    };
  } catch (error) {
    console.error("Error fetching payout settings:", error);
    // Return defaults if query fails
    return {
      success: true,
      data: {
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
}

/**
 * Calculate next payout date based on schedule
 */
export async function calculateNextPayoutDate(
  schedule: "daily" | "weekly" | "biweekly" | "monthly" | null,
  payoutDayOfWeek: number | null,
  payoutDayOfMonth: number | null,
  lastPayoutAt: Date | null
): Promise<Date> {
  const now = new Date();
  const nextDate = new Date(now);

  if (schedule === "daily") {
    // If last payout was today, schedule for tomorrow
    if (lastPayoutAt) {
      const lastPayoutDate = new Date(lastPayoutAt);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastPayoutDay = new Date(
        lastPayoutDate.getFullYear(),
        lastPayoutDate.getMonth(),
        lastPayoutDate.getDate()
      );

      if (lastPayoutDay.getTime() === today.getTime()) {
        // Already paid today, schedule for tomorrow
        nextDate.setDate(nextDate.getDate() + 1);
      } else {
        // Can pay today
        return nextDate;
      }
    } else {
      // No previous payout, can pay today
      return nextDate;
    }
  } else if (schedule === "weekly" && payoutDayOfWeek !== null) {
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
  schedule?: "daily" | "weekly" | "biweekly" | "monthly" | null;
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
    // Try to get existing settings with all columns
    let existing: PayoutSettingsRow | PayoutSettingsRawRow | null = null;
    try {
      const [settings] = await db
        .select()
        .from(sellerPayoutSettings)
        .where(eq(sellerPayoutSettings.storeId, storeId))
        .limit(1);
      existing = settings as PayoutSettingsRow;
    } catch (selectError) {
      // If select fails (columns don't exist), try raw SQL
      console.warn("Select failed, trying fallback:", selectError);
      try {
        const result = await db.execute(
          sql`SELECT * FROM seller_payout_settings WHERE store_id = ${storeId} LIMIT 1`
        );
        if (result.rows && result.rows.length > 0) {
          existing = result.rows[0] as PayoutSettingsRawRow;
        }
      } catch (fallbackError) {
        console.warn("Fallback select also failed:", fallbackError);
      }
    }

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
      // Build update object with only columns that exist
      type UpdateData = {
        method: string;
        schedule: string | null;
        minimumAmount: string;
        payoutDayOfWeek: number | null;
        payoutDayOfMonth: number | null;
        updatedAt: Date;
        holdPeriodDays?: number;
        nextPayoutAt?: Date | null;
      };

      const updateData: UpdateData = {
        method: params.method,
        schedule: params.schedule || null,
        minimumAmount: params.minimumAmount
          ? params.minimumAmount.toFixed(2)
          : "20.00",
        payoutDayOfWeek: params.payoutDayOfWeek || null,
        payoutDayOfMonth: params.payoutDayOfMonth || null,
        updatedAt: new Date(),
      };

      // Only add holdPeriodDays and nextPayoutAt if they exist in the table
      // We'll try to update them, and if it fails, we'll retry without them
      const existingHoldPeriod =
        "holdPeriodDays" in existing
          ? existing.holdPeriodDays
          : "hold_period_days" in existing
            ? existing.hold_period_days
            : undefined;
      const existingNextPayout =
        "nextPayoutAt" in existing
          ? existing.nextPayoutAt
          : "next_payout_at" in existing
            ? existing.next_payout_at
            : undefined;

      if (
        existingHoldPeriod !== undefined ||
        params.holdPeriodDays !== undefined
      ) {
        updateData.holdPeriodDays =
          params.holdPeriodDays ?? existingHoldPeriod ?? 7;
      }
      if (nextPayoutAt !== null || existingNextPayout !== undefined) {
        updateData.nextPayoutAt = nextPayoutAt;
      }

      try {
        await db
          .update(sellerPayoutSettings)
          .set(updateData)
          .where(eq(sellerPayoutSettings.storeId, storeId));
      } catch (updateError) {
        // If update fails (columns don't exist), try without optional columns
        console.warn(
          "Update failed, retrying without optional columns:",
          updateError
        );
        const basicUpdateData: {
          method: string;
          schedule: string | null;
          minimumAmount: string;
          payoutDayOfWeek: number | null;
          payoutDayOfMonth: number | null;
          updatedAt: Date;
        } = {
          method: params.method,
          schedule: params.schedule || null,
          minimumAmount: params.minimumAmount
            ? params.minimumAmount.toFixed(2)
            : "20.00",
          payoutDayOfWeek: params.payoutDayOfWeek || null,
          payoutDayOfMonth: params.payoutDayOfMonth || null,
          updatedAt: new Date(),
        };
        await db
          .update(sellerPayoutSettings)
          .set(basicUpdateData)
          .where(eq(sellerPayoutSettings.storeId, storeId));
      }
    } else {
      // Insert new settings - use raw SQL to only insert base columns that definitely exist
      // This avoids Drizzle trying to include optional columns from the schema
      await db.execute(
        sql`INSERT INTO seller_payout_settings (store_id, method, schedule, minimum_amount, payout_day_of_week, payout_day_of_month, created_at, updated_at)
            VALUES (${storeId}, ${params.method}, ${params.schedule || null}, ${params.minimumAmount ? params.minimumAmount.toFixed(2) : "20.00"}, ${params.payoutDayOfWeek || null}, ${params.payoutDayOfMonth || null}, NOW(), NOW())`
      );

      // Try to update optional columns if they exist (migration 0055)
      // This is a separate operation so it won't fail the insert if columns don't exist
      try {
        const holdPeriodDaysValue = params.holdPeriodDays ?? 7;
        if (nextPayoutAt !== null) {
          await db.execute(
            sql`UPDATE seller_payout_settings 
                SET hold_period_days = ${holdPeriodDaysValue}, 
                    next_payout_at = ${nextPayoutAt}, 
                    updated_at = NOW()
                WHERE store_id = ${storeId}`
          );
        } else {
          await db.execute(
            sql`UPDATE seller_payout_settings 
                SET hold_period_days = ${holdPeriodDaysValue}, 
                    updated_at = NOW()
                WHERE store_id = ${storeId}`
          );
        }
      } catch (optionalUpdateError) {
        // Optional columns don't exist (migration 0055 hasn't run)
        // This is expected and not an error - just log it
        console.warn(
          "Optional columns (holdPeriodDays, nextPayoutAt) don't exist, skipping update:",
          optionalUpdateError
        );
      }
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
