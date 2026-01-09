import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerBalanceTransactions, sellerBalances } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";

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
        amount: sellerBalanceTransactions.amount,
      })
      .from(sellerBalanceTransactions)
      .where(
        and(
          eq(sellerBalanceTransactions.status, "pending"),
          lte(sellerBalanceTransactions.availableAt, now)
        )
      );

    let updatedCount = 0;

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

          // Move from pending to available balance
          const [currentBalance] = await tx
            .select()
            .from(sellerBalances)
            .where(eq(sellerBalances.storeId, transaction.storeId))
            .limit(1);

          if (currentBalance) {
            const currentPending = parseFloat(currentBalance.pendingBalance);
            const currentAvailable = parseFloat(
              currentBalance.availableBalance
            );
            const newPending = Math.max(0, currentPending - amount);
            const newAvailable = currentAvailable + amount;

            await tx
              .update(sellerBalances)
              .set({
                pendingBalance: newPending.toFixed(2),
                availableBalance: newAvailable.toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(sellerBalances.storeId, transaction.storeId));
          }

          updatedCount++;
        });
      } catch (error) {
        console.error(`Error updating transaction ${transaction.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: transactionsToUpdate.length,
    });
  } catch (error) {
    console.error("Error updating hold periods:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
