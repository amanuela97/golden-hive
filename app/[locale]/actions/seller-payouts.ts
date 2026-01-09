"use server";

import { db } from "@/db";
import { sellerPayouts, sellerBalances, store } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStoreIdForUser } from "@/app/[locale]/actions/orders";
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
 */
export async function requestPayout(
  params: RequestPayoutParams
): Promise<{ success: boolean; error?: string; payoutId?: string }> {
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

    // Check available balance
    const [balance] = await db
      .select()
      .from(sellerBalances)
      .where(eq(sellerBalances.storeId, storeId))
      .limit(1);

    if (!balance) {
      return { success: false, error: "Balance not found" };
    }

    const availableBalance = parseFloat(balance.availableBalance);
    if (amount > availableBalance) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} ${currency}`,
      };
    }

    // Create payout request
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

    revalidatePath("/dashboard/payouts");

    return { success: true, payoutId: payout.id };
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
          amount: Math.round(parseFloat(payout.amount) * 100), // Convert to cents
          currency: payout.currency.toLowerCase(),
          destination: storeData.stripeAccountId,
        });
        transferId = transfer.id;
      } catch (error) {
        console.error("Error creating Stripe transfer:", error);
        throw new Error(
          `Failed to create Stripe transfer: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
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
