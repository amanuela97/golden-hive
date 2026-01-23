"use server";

import { db } from "@/db";
import {
  sellerPayouts,
  sellerBalances,
  store,
  sellerPayoutSettings,
} from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStoreIdForUser } from "@/app/[locale]/actions/orders";
import { formatCurrency } from "@/lib/utils";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

interface RequestPayoutParams {
  amount: number;
  currency: string;
}

/**
 * Request a payout (seller initiates)
 * If all checks pass, automatically processes the payout
 */
export async function requestPayout(params: RequestPayoutParams): Promise<{
  success: boolean;
  error?: string;
  payoutId?: string;
  transferId?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId } = await getStoreIdForUser();
    if (!storeId) {
      return { success: false, error: "Store not found" };
    }

    const { amount, currency } = params;

    // Validate amount
    if (amount <= 0) {
      return { success: false, error: "Amount must be greater than 0" };
    }

    // Get balance and settings
    const [balance] = await db
      .select()
      .from(sellerBalances)
      .where(eq(sellerBalances.storeId, storeId))
      .limit(1);

    if (!balance) {
      return { success: false, error: "Balance not found" };
    }

    const availableBalance = parseFloat(balance.availableBalance);

    // Check 1: Funds available
    if (amount > availableBalance) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} ${currency}`,
      };
    }

    // Get payout settings
    const [settings] = await db
      .select()
      .from(sellerPayoutSettings)
      .where(eq(sellerPayoutSettings.storeId, storeId))
      .limit(1);

    const minimumAmount = settings ? parseFloat(settings.minimumAmount) : 20.0;

    // Check 2: Minimum threshold met
    if (amount < minimumAmount) {
      return {
        success: false,
        error: `Minimum payout amount is ${formatCurrency(minimumAmount, currency)}`,
      };
    }

    // Check 3: No payment holds (check for pending payouts)
    const pendingPayouts = await db
      .select()
      .from(sellerPayouts)
      .where(
        and(
          eq(sellerPayouts.storeId, storeId),
          eq(sellerPayouts.status, "pending")
        )
      );

    if (pendingPayouts.length > 0) {
      return {
        success: false,
        error:
          "You have a pending payout request. Please wait for it to be processed.",
      };
    }

    // Check 4: No duplication - check if already paid today
    if (balance.lastPayoutAt) {
      const lastPayoutDate = new Date(balance.lastPayoutAt);
      const today = new Date();
      const isSameDay =
        lastPayoutDate.getDate() === today.getDate() &&
        lastPayoutDate.getMonth() === today.getMonth() &&
        lastPayoutDate.getFullYear() === today.getFullYear();

      if (isSameDay) {
        // Check if there's a completed payout today
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        const todayPayouts = await db
          .select()
          .from(sellerPayouts)
          .where(
            and(
              eq(sellerPayouts.storeId, storeId),
              eq(sellerPayouts.status, "completed"),
              gte(sellerPayouts.completedAt, todayStart)
            )
          );

        if (todayPayouts.length > 0) {
          return {
            success: false,
            error:
              "You have already received a payout today. Please try again tomorrow.",
          };
        }
      }
    }

    // All checks passed - create payout and process immediately
    const [payout] = await db
      .insert(sellerPayouts)
      .values({
        storeId,
        amount: amount.toFixed(2),
        currency,
        status: "pending",
        requestedBy: session.user.id,
      })
      .returning();

    // Automatically process the payout
    const processResult = await processPayout(payout.id);

    if (processResult.success) {
      // Revalidate all finance-related paths
      revalidatePath("/dashboard/finances");
      revalidatePath("/dashboard/finances/payouts");
      revalidatePath("/dashboard/finances/transactions");

      return {
        success: true,
        payoutId: payout.id,
        transferId: processResult.transferId,
      };
    } else {
      // If processing failed, return error
      return {
        success: false,
        error: processResult.error || "Failed to process payout",
        payoutId: payout.id,
      };
    }
  } catch (error) {
    console.error("Error requesting payout:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process a payout (admin/system processes pending payout)
 * Creates Stripe transfer to seller's connected account
 */
export async function processPayout(
  payoutId: string
): Promise<{ success: boolean; error?: string; transferId?: string }> {
  try {
    // Get payout
    const [payout] = await db
      .select()
      .from(sellerPayouts)
      .where(
        and(eq(sellerPayouts.id, payoutId), eq(sellerPayouts.status, "pending"))
      )
      .limit(1);

    if (!payout) {
      return { success: false, error: "Payout not found or already processed" };
    }

    // Get store's Stripe account ID
    const [storeData] = await db
      .select()
      .from(store)
      .where(eq(store.id, payout.storeId))
      .limit(1);

    // Check Stripe account balance before attempting transfer
    const payoutAmountCents = Math.round(parseFloat(payout.amount) * 100);
    let stripeBalance: Stripe.Balance | null = null;

    try {
      stripeBalance = await stripe.balance.retrieve();
    } catch (balanceError) {
      console.error("Error retrieving Stripe balance:", balanceError);
      // Continue anyway - Stripe will fail the transfer if insufficient funds
    }

    if (stripeBalance) {
      // Find available balance for the payout currency
      const currencyBalance = stripeBalance.available.find(
        (b) => b.currency.toLowerCase() === payout.currency.toLowerCase()
      );

      const availableBalanceCents = currencyBalance?.amount || 0;

      if (availableBalanceCents < payoutAmountCents) {
        const availableBalance = (availableBalanceCents / 100).toFixed(2);
        const errorMessage = `Insufficient funds in payment account. Available: ${availableBalance} ${payout.currency}, Required: ${payout.amount} ${payout.currency}. Please ensure payments are captured before requesting payouts.`;

        // Mark payout as failed
        await db
          .update(sellerPayouts)
          .set({
            status: "failed",
            failureReason: errorMessage,
          })
          .where(eq(sellerPayouts.id, payoutId));

        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    // Update payout status to processing
    await db
      .update(sellerPayouts)
      .set({
        status: "processing",
        processedAt: new Date(),
      })
      .where(eq(sellerPayouts.id, payoutId));

    // Create Stripe transfer
    let transferId: string;
    if (storeData?.stripeAccountId) {
      try {
        const transfer = await stripe.transfers.create({
          amount: payoutAmountCents,
          currency: payout.currency.toLowerCase(),
          destination: storeData.stripeAccountId,
        });
        transferId = transfer.id;
      } catch (error) {
        console.error("Error creating Stripe transfer:", error);

        // Provide user-friendly error messages for common Stripe errors
        let errorMessage = "Failed to process payout";

        if (error && typeof error === "object" && "code" in error) {
          const stripeError = error as { code?: string; message?: string };

          if (stripeError.code === "balance_insufficient") {
            errorMessage =
              "Unable to process payout: Insufficient funds in payment account. Please contact support or try again later.";
          } else if (stripeError.code === "account_invalid") {
            errorMessage =
              "Unable to process payout: Payment account is not properly configured. Please contact support.";
          } else if (stripeError.message) {
            errorMessage = `Unable to process payout: ${stripeError.message}`;
          }
        } else if (error instanceof Error) {
          // Check if it's a test mode balance error
          if (error.message.includes("insufficient available funds")) {
            errorMessage =
              "Unable to process payout: Payment processing temporarily unavailable. Please try again later or contact support.";
          } else {
            errorMessage = `Unable to process payout: ${error.message}`;
          }
        }

        throw new Error(errorMessage);
      }
    } else {
      // Fallback for testing (remove in production)
      transferId = `tr_sim_${Date.now()}`;
    }

    // Update payout with transfer ID
    await db
      .update(sellerPayouts)
      .set({
        stripeTransferId: transferId,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(sellerPayouts.id, payoutId));

    // Deduct from seller balance using updateSellerBalance
    const { updateSellerBalance } = await import("./seller-balance");
    await updateSellerBalance({
      storeId: payout.storeId,
      type: "payout",
      amount: parseFloat(payout.amount),
      currency: payout.currency,
      payoutId: payout.id,
      description: `Payout request processed`,
    });

    // Update last payout info in balance
    await db
      .update(sellerBalances)
      .set({
        lastPayoutAt: new Date(),
        lastPayoutAmount: payout.amount,
        updatedAt: new Date(),
      })
      .where(eq(sellerBalances.storeId, payout.storeId));

    revalidatePath("/dashboard/payouts");

    return { success: true, transferId };
  } catch (error) {
    console.error("Error processing payout:", error);

    // Mark payout as failed
    await db
      .update(sellerPayouts)
      .set({
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(sellerPayouts.id, payoutId));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process payout by store ID (for cron jobs)
 */
export async function processPayoutByStoreId(params: {
  storeId: string;
  amount: number;
  currency: string;
}): Promise<{
  success: boolean;
  error?: string;
  payoutId?: string;
  transferId?: string;
}> {
  try {
    // Create payout request
    const [payout] = await db
      .insert(sellerPayouts)
      .values({
        storeId: params.storeId,
        amount: params.amount.toFixed(2),
        currency: params.currency,
        status: "pending",
        requestedBy: null, // System-initiated
      })
      .returning();

    // Process the payout
    const result = await processPayout(payout.id);

    if (result.success) {
      return {
        success: true,
        payoutId: payout.id,
        transferId: result.transferId,
      };
    }

    return { success: false, error: result.error };
  } catch (error) {
    console.error("Error processing payout by store ID:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get payout history for a store
 */
export async function getPayouts(storeId: string) {
  try {
    const payouts = await db
      .select()
      .from(sellerPayouts)
      .where(eq(sellerPayouts.storeId, storeId))
      .orderBy(desc(sellerPayouts.createdAt));

    return {
      success: true,
      data: payouts.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount),
        currency: p.currency,
        status: p.status,
        stripeTransferId: p.stripeTransferId,
        requestedAt: p.requestedAt,
        processedAt: p.processedAt,
        completedAt: p.completedAt,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error getting payouts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
