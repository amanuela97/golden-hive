import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  sellerBalanceTransactions,
  sellerBalances,
  orderPayments,
  store,
} from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all pending transactions where availableAt <= now
    const transactionsToUpdate = await db
      .select({
        id: sellerBalanceTransactions.id,
        storeId: sellerBalanceTransactions.storeId,
        currency: sellerBalanceTransactions.currency,
        amount: sellerBalanceTransactions.amount,
        type: sellerBalanceTransactions.type,
        orderPaymentId: sellerBalanceTransactions.orderPaymentId,
      })
      .from(sellerBalanceTransactions)
      .where(
        and(
          eq(sellerBalanceTransactions.status, "pending"),
          lte(sellerBalanceTransactions.availableAt, now)
        )
      );

    let updatedCount = 0;
    const updatedStoreIds = new Set<string>();

    // Update status to "available" and move balance from pending to available
    for (const transaction of transactionsToUpdate) {
      try {
        await db.transaction(async (tx) => {
          // Update transaction status
          await tx
            .update(sellerBalanceTransactions)
            .set({ status: "available" })
            .where(eq(sellerBalanceTransactions.id, transaction.id));

          const amount = parseFloat(transaction.amount);
          const currency = transaction.currency;

          // Move from pending to available for this (store, currency) wallet
          const [currentBalance] = await tx
            .select()
            .from(sellerBalances)
            .where(
              and(
                eq(sellerBalances.storeId, transaction.storeId),
                eq(sellerBalances.currency, currency)
              )
            )
            .limit(1);

          if (currentBalance) {
            const currentPending = parseFloat(currentBalance.pendingBalance);
            const currentAvailable = parseFloat(
              currentBalance.availableBalance
            );
            const newPending = Math.max(0, currentPending - amount);
            const newAvailable = currentAvailable + amount;

            console.log(
              `[Hold Period] Updating balance for store ${transaction.storeId} ${currency}:`,
              {
                transactionId: transaction.id,
                amount,
                currentPending,
                currentAvailable,
                newPending,
                newAvailable,
              }
            );

            await tx
              .update(sellerBalances)
              .set({
                pendingBalance: newPending.toFixed(2),
                availableBalance: newAvailable.toFixed(2),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(sellerBalances.storeId, transaction.storeId),
                  eq(sellerBalances.currency, currency)
                )
              );

            updatedStoreIds.add(transaction.storeId);
          } else {
            console.warn(
              `[Hold Period] No balance record found for store ${transaction.storeId} currency ${currency}`
            );
          }

          updatedCount++;
        });

        // Separate charges + transfers: when hold ends, transfer seller share from platform to connected account
        if (
          transaction.type === "order_payment" &&
          transaction.orderPaymentId
        ) {
          try {
            const [op] = await db
              .select()
              .from(orderPayments)
              .where(eq(orderPayments.id, transaction.orderPaymentId))
              .limit(1);
            if (!op || op.transferStatus !== "held") continue;
            if (op.provider === "esewa") continue;
            const netAmount = parseFloat(op.netAmountToStore || "0");
            if (netAmount <= 0) continue;
            const [storeRow] = await db
              .select()
              .from(store)
              .where(eq(store.id, transaction.storeId))
              .limit(1);
            if (!storeRow?.stripeAccountId) {
              console.warn(
                `[Hold Period] No Stripe account for store ${transaction.storeId}, skipping transfer`
              );
              continue;
            }
            let chargeId = op.stripeChargeId;
            if (!chargeId && op.stripePaymentIntentId) {
              const pi = await stripe.paymentIntents.retrieve(
                op.stripePaymentIntentId
              );
              chargeId =
                typeof pi.latest_charge === "string"
                  ? pi.latest_charge
                  : pi.latest_charge?.id ?? null;
            }
            if (!chargeId) {
              console.warn(
                `[Hold Period] No charge ID for order payment ${op.id}, skipping transfer`
              );
              continue;
            }
            const transfer = await stripe.transfers.create({
              amount: Math.round(netAmount * 100),
              currency: op.currency.toLowerCase(),
              destination: storeRow.stripeAccountId,
              source_transaction: chargeId,
            });
            await db
              .update(orderPayments)
              .set({
                transferStatus: "transferred",
                stripeTransferId: transfer.id,
                updatedAt: new Date(),
              })
              .where(eq(orderPayments.id, op.id));
            console.log("[Hold Period] Transferred to connected account:", {
              orderPaymentId: op.id,
              transferId: transfer.id,
              amount: netAmount,
            });
          } catch (transferError) {
            console.error(
              `[Hold Period] Transfer failed for order payment ${transaction.orderPaymentId}:`,
              transferError
            );
            // Ledger already updated; transfer can be retried later or handled manually
          }
        }
      } catch (error) {
        console.error(`Error updating transaction ${transaction.id}:`, error);
      }
    }

    // Revalidate paths after all updates are complete (outside of render)
    if (updatedStoreIds.size > 0) {
      revalidatePath("/dashboard/finances/payouts");
      revalidatePath("/dashboard/balance");
    }

    // When nothing was updated, return debug info so callers can see why (e.g. available_at still in future)
    const debug =
      transactionsToUpdate.length === 0
        ? await db
            .select({
              pendingCount: sql<number>`count(*)::int`,
              minAvailableAt: sql<string | null>`min(${sellerBalanceTransactions.availableAt}::timestamptz)::text`,
            })
            .from(sellerBalanceTransactions)
            .where(eq(sellerBalanceTransactions.status, "pending"))
            .then((rows) => rows[0] ?? { pendingCount: 0, minAvailableAt: null })
            .catch(() => null)
        : null;

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: transactionsToUpdate.length,
      ...(debug && {
        debug: {
          pendingTransactionsNotYetDue: debug.pendingCount,
          earliestAvailableAt: debug.minAvailableAt,
          hint:
            debug.pendingCount > 0
              ? "Pending rows have available_at in the future. For testing: set HOLD_PERIOD_DAYS=0 in env (or run: UPDATE seller_balance_transactions SET available_at = NOW() - INTERVAL '1 minute' WHERE status = 'pending' AND type = 'order_payment';)"
              : undefined,
        },
      }),
    });
  } catch (error) {
    console.error("Error updating hold periods:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
