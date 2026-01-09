import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerPayoutSettings, sellerBalances, store } from "@/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { processPayoutByStoreId } from "@/app/[locale]/actions/seller-payouts";
import { calculateNextPayoutDate } from "@/app/[locale]/actions/finances";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Find all sellers with automatic payout enabled and nextPayoutAt <= now
    const eligibleSellers = await db
      .select({
        settings: sellerPayoutSettings,
        balance: sellerBalances,
        storeData: store,
      })
      .from(sellerPayoutSettings)
      .innerJoin(
        sellerBalances,
        eq(sellerPayoutSettings.storeId, sellerBalances.storeId)
      )
      .innerJoin(store, eq(sellerPayoutSettings.storeId, store.id))
      .where(
        and(
          eq(sellerPayoutSettings.method, "automatic"),
          isNotNull(sellerPayoutSettings.nextPayoutAt),
          lte(sellerPayoutSettings.nextPayoutAt, now)
        )
      );

    for (const { settings, balance, storeData } of eligibleSellers) {
      try {
        const availableBalance = parseFloat(balance.availableBalance);
        const minimumAmount = parseFloat(settings.minimumAmount);
        const amountDue = Math.max(0, -availableBalance);

        // Check eligibility
        if (availableBalance < minimumAmount) {
          results.skipped++;
          continue;
        }

        if (amountDue > 0) {
          results.skipped++;
          continue;
        }

        // Check if Stripe account is ready
        if (!storeData.stripeAccountId || !storeData.stripePayoutsEnabled) {
          results.skipped++;
          continue;
        }

        // Process payout
        const payoutResult = await processPayoutByStoreId({
          storeId: settings.storeId,
          amount: availableBalance,
          currency: balance.currency,
        });

        if (payoutResult.success) {
          // Calculate next payout date
          const nextPayoutAt = await calculateNextPayoutDate(
            settings.schedule as "weekly" | "biweekly" | "monthly" | null,
            settings.payoutDayOfWeek,
            settings.payoutDayOfMonth,
            new Date() // Use current date as last payout
          );

          // Update nextPayoutAt
          await db
            .update(sellerPayoutSettings)
            .set({ nextPayoutAt })
            .where(eq(sellerPayoutSettings.id, settings.id));

          results.processed++;
        } else {
          results.errors.push(
            `Store ${settings.storeId}: ${payoutResult.error}`
          );
        }
      } catch (error) {
        results.errors.push(
          `Store ${settings.storeId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error processing scheduled payouts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
