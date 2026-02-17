"use server";

import { db } from "@/db";
import {
  sellerBalances,
  sellerBalanceTransactions,
  sellerPayoutSettings,
  store,
} from "@/db/schema";
import { eq, desc, and, or, gte, lte, ilike, sql } from "drizzle-orm";
import { getStoreIdForUser } from "./store-id";
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

/** Per-currency wallet summary (EUR = Stripe, NPR = eSewa) */
export type WalletSummary = {
  availableBalance: number;
  pendingBalance: number;
  amountDue: number;
  reservedFeesFromPending: number;
  currentBalance: number;
  currency: string;
  lastPayoutAt: Date | null;
  lastPayoutAmount: number | null;
  stripeConnectedAvailable: number | null;
  stripeConnectedPending: number | null;
};

/**
 * Get comprehensive balance summary: two wallets per seller (EUR, NPR).
 * Returns data.wallets.EUR and data.wallets.NPR.
 */
export async function getBalanceSummary(): Promise<
  | { success: false; error: string }
  | {
      success: true;
      data: { wallets: { EUR: WalletSummary; NPR: WalletSummary } };
    }
> {
  const { storeId } = await getStoreIdForUser();
  if (!storeId) {
    return { success: false, error: "Store not found" };
  }

  const balanceRows = await db
    .select()
    .from(sellerBalances)
    .where(eq(sellerBalances.storeId, storeId));

  const wallets: { EUR: WalletSummary; NPR: WalletSummary } = {
    EUR: {
      availableBalance: 0,
      pendingBalance: 0,
      amountDue: 0,
      reservedFeesFromPending: 0,
      currentBalance: 0,
      currency: "EUR",
      lastPayoutAt: null,
      lastPayoutAmount: null,
      stripeConnectedAvailable: null,
      stripeConnectedPending: null,
    },
    NPR: {
      availableBalance: 0,
      pendingBalance: 0,
      amountDue: 0,
      reservedFeesFromPending: 0,
      currentBalance: 0,
      currency: "NPR",
      lastPayoutAt: null,
      lastPayoutAmount: null,
      stripeConnectedAvailable: null,
      stripeConnectedPending: null,
    },
  };

  const stripeConnectedByCurrency: Record<
    string,
    { available: number; pending: number }
  > = {};
  try {
    const [storeRow] = await db
      .select({ stripeAccountId: store.stripeAccountId })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);
    if (storeRow?.stripeAccountId) {
      const { stripe } = await import("@/lib/stripe");
      const connectedBalance = await stripe.balance.retrieve({
        stripeAccount: storeRow.stripeAccountId,
      });
      for (const b of connectedBalance.available) {
        const c = b.currency.toUpperCase();
        if (!stripeConnectedByCurrency[c])
          stripeConnectedByCurrency[c] = { available: 0, pending: 0 };
        stripeConnectedByCurrency[c].available = b.amount / 100;
      }
      for (const b of connectedBalance.pending) {
        const c = b.currency.toUpperCase();
        if (!stripeConnectedByCurrency[c])
          stripeConnectedByCurrency[c] = { available: 0, pending: 0 };
        stripeConnectedByCurrency[c].pending = b.amount / 100;
      }
    }
  } catch (error) {
    console.error(
      "[Balance Summary] Error retrieving connected account balance:",
      error
    );
  }

  for (const balance of balanceRows) {
    const currency = balance.currency.toUpperCase();
    if (currency !== "EUR" && currency !== "NPR") continue;

    const ledgerAvailable = parseFloat(balance.availableBalance);
    const pendingBalance = parseFloat(balance.pendingBalance);
    const connected = stripeConnectedByCurrency[currency];
    const stripeConnectedAvailable = connected ? connected.available : null;
    const stripeConnectedPending = connected ? connected.pending : null;

    const availableBalance =
      stripeConnectedAvailable !== null &&
      stripeConnectedAvailable !== undefined
        ? Math.min(
            Math.max(0, ledgerAvailable),
            Math.max(0, stripeConnectedAvailable)
          )
        : Math.max(0, ledgerAvailable);

    const negativeAvailable = -ledgerAvailable;
    const pendingCoversFees =
      ledgerAvailable < 0 &&
      pendingBalance > 0 &&
      pendingBalance >= negativeAvailable;
    const amountDue = pendingCoversFees ? 0 : Math.max(0, negativeAvailable);
    const reservedFeesFromPending = pendingCoversFees ? negativeAvailable : 0;

    wallets[currency as "EUR" | "NPR"] = {
      availableBalance,
      pendingBalance,
      amountDue,
      reservedFeesFromPending,
      currentBalance: ledgerAvailable + pendingBalance,
      currency: balance.currency,
      lastPayoutAt: balance.lastPayoutAt,
      lastPayoutAmount: balance.lastPayoutAmount
        ? parseFloat(balance.lastPayoutAmount)
        : null,
      stripeConnectedAvailable: stripeConnectedAvailable ?? null,
      stripeConnectedPending: stripeConnectedPending ?? null,
    };
  }

  return { success: true, data: { wallets } };
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
    esewa_fee: "eSewa fee",
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

      // Hold period is platform-enforced from env (no per-store setting)
      const { getHoldPeriodDays } = await import("@/lib/utils");
      const holdPeriodDays = getHoldPeriodDays();

      // Try to get optional column next_payout_at if it exists (migration 0055)
      let nextPayoutAt: Date | null = null;
      try {
        const optionalResult = await db.execute(
          sql`SELECT next_payout_at
              FROM seller_payout_settings 
              WHERE store_id = ${storeId} 
              LIMIT 1`
        );

        if (optionalResult.rows && optionalResult.rows.length > 0) {
          const optionalRow = optionalResult.rows[0] as {
            next_payout_at?: Date | string | null;
          };
          nextPayoutAt = optionalRow.next_payout_at
            ? new Date(optionalRow.next_payout_at)
            : null;

          // If nextPayoutAt is in the past and automatic is enabled, recalculate it
          if (
            nextPayoutAt &&
            row.method === "automatic" &&
            row.schedule &&
            nextPayoutAt < new Date()
          ) {
            console.warn(
              `nextPayoutAt (${nextPayoutAt.toISOString()}) is in the past for store ${storeId}. Recalculating...`
            );
            // Get last payout date from balance (use EUR wallet for schedule; or any)
            const balanceRows = await db
              .select({ lastPayoutAt: sellerBalances.lastPayoutAt })
              .from(sellerBalances)
              .where(eq(sellerBalances.storeId, storeId));
            const lastPayoutAt =
              balanceRows.find((b) => b.lastPayoutAt)?.lastPayoutAt ?? null;

            nextPayoutAt = await calculateNextPayoutDate(
              row.schedule as "daily" | "weekly" | "biweekly" | "monthly" | null,
              row.payout_day_of_week,
              row.payout_day_of_month,
              lastPayoutAt
            );

            // Update the database with the corrected date
            // Note: We don't revalidate here because this function is called during render
            // The page will show the updated date on next refresh
            try {
              await db.execute(
                sql`UPDATE seller_payout_settings 
                    SET next_payout_at = ${nextPayoutAt.toISOString()} 
                    WHERE store_id = ${storeId}`
              );
              // Return the corrected date so it's shown immediately
              // The database is updated, and the page will reflect it on next request
            } catch (updateError) {
              console.error(
                "Failed to update nextPayoutAt in database:",
                updateError
              );
            }
          }
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

    // No settings found, return defaults (hold period from env)
    const { getHoldPeriodDays } = await import("@/lib/utils");
    return {
      success: true,
      data: {
        method: "manual" as const,
        schedule: null,
        minimumAmount: 20.0,
        payoutDayOfWeek: null,
        payoutDayOfMonth: null,
        holdPeriodDays: getHoldPeriodDays(),
        nextPayoutAt: null,
      },
    };
  } catch (error) {
    console.error("Error fetching payout settings:", error);
    const { getHoldPeriodDays } = await import("@/lib/utils");
    return {
      success: true,
      data: {
        method: "manual" as const,
        schedule: null,
        minimumAmount: 20.0,
        payoutDayOfWeek: null,
        payoutDayOfMonth: null,
        holdPeriodDays: getHoldPeriodDays(),
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
    // If daysUntilNext is 0, it means today is the payout day
    // Schedule for next week (7 days) if we already processed today, otherwise today
    if (daysUntilNext === 0 && lastPayoutAt) {
      const lastPayoutDate = new Date(lastPayoutAt);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastPayoutDay = new Date(
        lastPayoutDate.getFullYear(),
        lastPayoutDate.getMonth(),
        lastPayoutDate.getDate()
      );
      // If we already paid today, schedule for next week
      if (lastPayoutDay.getTime() === today.getTime()) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        // Can pay today
        return nextDate;
      }
    } else {
      nextDate.setDate(nextDate.getDate() + daysUntilNext);
    }
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
      // Get last payout date from any wallet
      const balanceRows = await db
        .select({ lastPayoutAt: sellerBalances.lastPayoutAt })
        .from(sellerBalances)
        .where(eq(sellerBalances.storeId, storeId));
      const lastPayoutAt =
        balanceRows.reduce<Date | null>((latest, b) => {
          if (!b.lastPayoutAt) return latest;
          return !latest || b.lastPayoutAt > latest ? b.lastPayoutAt : latest;
        }, null) ?? null;
      nextPayoutAt = await calculateNextPayoutDate(
        params.schedule,
        params.payoutDayOfWeek || null,
        params.payoutDayOfMonth || null,
        lastPayoutAt
      );

      // If nextPayoutAt is in the past, recalculate from today
      const now = new Date();
      if (nextPayoutAt < now) {
        console.warn(
          `Calculated nextPayoutAt (${nextPayoutAt.toISOString()}) is in the past. Recalculating from today.`
        );
        nextPayoutAt = await calculateNextPayoutDate(
          params.schedule,
          params.payoutDayOfWeek || null,
          params.payoutDayOfMonth || null,
          null // Start fresh from today
        );
      }
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

      // Only add nextPayoutAt if it exists in the table (hold period is platform-enforced from env, not stored per store)
      const existingNextPayout =
        "nextPayoutAt" in existing
          ? existing.nextPayoutAt
          : "next_payout_at" in existing
            ? existing.next_payout_at
            : undefined;
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

      // Try to update next_payout_at if column exists (hold period is platform-enforced from env)
      if (nextPayoutAt !== null) {
        try {
          await db.execute(
            sql`UPDATE seller_payout_settings 
                SET next_payout_at = ${nextPayoutAt}, 
                    updated_at = NOW()
                WHERE store_id = ${storeId}`
          );
        } catch (optionalUpdateError) {
          console.warn(
            "Optional column next_payout_at doesn't exist, skipping update:",
            optionalUpdateError
          );
        }
      }
    }

    revalidatePath("/dashboard/finances");
    revalidatePath("/dashboard/finances/payouts");
    return { success: true };
  } catch (error) {
    console.error("Error updating payout settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
