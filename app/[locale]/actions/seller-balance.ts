"use server";

import { db } from "@/db";
import {
  sellerBalances,
  sellerBalanceTransactions,
  sellerPayoutSettings,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { InferSelectModel } from "drizzle-orm";

type BalanceTransactionType = InferSelectModel<
  typeof sellerBalanceTransactions
>["type"];

// Type for payout settings that may or may not have optional columns
type PayoutSettingsRow = InferSelectModel<typeof sellerPayoutSettings> & {
  holdPeriodDays?: number | null;
};

interface UpdateSellerBalanceParams {
  storeId: string;
  type: BalanceTransactionType;
  amount: number; // Always positive, type determines +/- (CREDIT or DEBIT)
  currency: string;
  orderId?: string;
  orderPaymentId?: string;
  orderShipmentId?: string;
  payoutId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Update seller balance and create an immutable ledger entry.
 * This is the single source of truth for all balance changes.
 *
 * CREDITS (increase balance):
 * - order_payment: Payment received from customer
 *
 * DEBITS (decrease balance):
 * - platform_fee: Platform commission (5%)
 * - stripe_fee: Stripe processing fee
 * - shipping_label: Cost of shipping label
 * - refund: Refund to customer
 * - dispute: Chargeback/dispute fee
 * - payout: Funds transferred to seller
 * - adjustment: Manual adjustment (admin)
 */
export async function updateSellerBalance(
  params: UpdateSellerBalanceParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      storeId,
      type,
      amount,
      currency,
      orderId,
      orderPaymentId,
      orderShipmentId,
      payoutId,
      description,
      metadata,
    } = params;

    // Determine if this is a credit or debit
    // CREDITS (increase balance): order_payment, adjustment (if positive)
    // DEBITS (decrease balance): platform_fee, stripe_fee, shipping_label_cost, refund, dispute, payout, adjustment (if negative)
    const isCredit = type === "order_payment";
    // For adjustment, check if amount is positive (credit) or negative (debit)
    const amountChange =
      isCredit || (type === "adjustment" && amount > 0) ? amount : -amount;

    // Get or create seller balance
    const [existingBalance] = await db
      .select()
      .from(sellerBalances)
      .where(eq(sellerBalances.storeId, storeId))
      .limit(1);

    let balanceBefore: number;
    let balanceAfter: number;

    // Determine if this should go to pending or available balance
    const isPending = type === "order_payment";

    if (existingBalance) {
      const currentAvailable = parseFloat(existingBalance.availableBalance);
      const currentPending = parseFloat(existingBalance.pendingBalance);

      if (isPending) {
        // Add to pending balance
        balanceBefore = currentPending;
        balanceAfter = currentPending + amountChange;
        await db
          .update(sellerBalances)
          .set({
            pendingBalance: balanceAfter.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(sellerBalances.storeId, storeId));
      } else {
        // Add to available balance (or subtract for debits)
        balanceBefore = currentAvailable;
        balanceAfter = currentAvailable + amountChange;
        await db
          .update(sellerBalances)
          .set({
            availableBalance: balanceAfter.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(sellerBalances.storeId, storeId));
      }
    } else {
      // Create new balance record
      balanceBefore = 0;
      balanceAfter = amountChange;

      await db.insert(sellerBalances).values({
        storeId,
        availableBalance: isPending ? "0" : balanceAfter.toFixed(2),
        pendingBalance: isPending ? balanceAfter.toFixed(2) : "0",
        currency,
      });
    }

    // Get hold period from settings (default 7 days)
    let holdPeriodDays = 7;
    try {
      const [settings] = await db
        .select()
        .from(sellerPayoutSettings)
        .where(eq(sellerPayoutSettings.storeId, storeId))
        .limit(1);

      holdPeriodDays = (settings as PayoutSettingsRow)?.holdPeriodDays || 7;
    } catch (error) {
      console.warn(
        "Could not fetch hold period from settings, using default:",
        error
      );
      holdPeriodDays = 7;
    }

    // Calculate availableAt date (only for credits that need hold period)
    let availableAt: Date | null = null;
    let status: "pending" | "available" | "paid" = "available";

    // Only order_payment transactions need hold period
    if (type === "order_payment") {
      availableAt = new Date();
      availableAt.setDate(availableAt.getDate() + holdPeriodDays);
      status = "pending";
    } else if (type === "payout") {
      // Payouts are immediately marked as paid
      status = "paid";
    }

    // Create immutable ledger entry
    await db.insert(sellerBalanceTransactions).values({
      storeId,
      type,
      amount: amount.toFixed(2),
      currency,
      orderId,
      orderPaymentId,
      orderShipmentId,
      payoutId,
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      status,
      availableAt,
      description,
      metadata,
    });

    // Revalidate seller dashboard pages
    revalidatePath("/dashboard/payouts");
    revalidatePath("/dashboard/balance");

    return { success: true };
  } catch (error) {
    console.error("Error updating seller balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current seller balance
 */
export async function getSellerBalance(storeId: string) {
  try {
    const [balance] = await db
      .select()
      .from(sellerBalances)
      .where(eq(sellerBalances.storeId, storeId))
      .limit(1);

    if (!balance) {
      // Return zero balance if not found
      return {
        success: true,
        data: {
          availableBalance: 0,
          pendingBalance: 0,
          currency: "EUR",
        },
      };
    }

    return {
      success: true,
      data: {
        availableBalance: parseFloat(balance.availableBalance),
        pendingBalance: parseFloat(balance.pendingBalance),
        currency: balance.currency,
        lastPayoutAt: balance.lastPayoutAt,
        lastPayoutAmount: balance.lastPayoutAmount
          ? parseFloat(balance.lastPayoutAmount)
          : null,
      },
    };
  } catch (error) {
    console.error("Error getting seller balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get seller balance transaction history
 */
export async function getSellerBalanceTransactions(
  storeId: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    const transactions = await db
      .select()
      .from(sellerBalanceTransactions)
      .where(eq(sellerBalanceTransactions.storeId, storeId))
      .orderBy(desc(sellerBalanceTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        currency: t.currency,
        balanceBefore: parseFloat(t.balanceBefore),
        balanceAfter: parseFloat(t.balanceAfter),
        description: t.description,
        metadata: t.metadata,
        orderId: t.orderId,
        orderPaymentId: t.orderPaymentId,
        orderShipmentId: t.orderShipmentId,
        payoutId: t.payoutId,
        createdAt: t.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error getting balance transactions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
