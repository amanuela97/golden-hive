import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerPayoutSettings, sellerBalances, store } from "@/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { processPayoutByStoreId } from "@/app/[locale]/actions/seller-payouts";
import { calculateNextPayoutDate } from "@/app/[locale]/actions/finances";
import { stripe } from "@/lib/stripe";

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
        const ledgerAvailableBalance = parseFloat(balance.availableBalance);
        const minimumAmount = parseFloat(settings.minimumAmount);
        const amountDue = Math.max(0, -ledgerAvailableBalance);

        // Check eligibility based on ledger
        if (ledgerAvailableBalance < minimumAmount) {
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

        // Check actual Stripe balance to ensure funds are available
        // For connected accounts, retrieve balance from the connected account
        let stripeAvailableBalance = 0;
        try {
          const stripeBalance = await stripe.balance.retrieve({
            stripeAccount: storeData.stripeAccountId,
          });
          const currencyBalance = stripeBalance.available.find(
            (b) => b.currency.toLowerCase() === balance.currency.toLowerCase()
          );
          // Convert from cents to dollars/euros
          stripeAvailableBalance = currencyBalance
            ? currencyBalance.amount / 100
            : 0;
        } catch (stripeError) {
          console.error(
            `Error retrieving Stripe balance for store ${settings.storeId} (account ${storeData.stripeAccountId}):`,
            stripeError
          );
          // If we can't check Stripe balance, skip this payout to be safe
          results.skipped++;
          continue;
        }

        // Use the minimum of ledger and Stripe balance
        // This ensures we only payout funds that actually exist in Stripe
        const availableBalance = Math.min(
          Math.max(0, ledgerAvailableBalance),
          Math.max(0, stripeAvailableBalance)
        );

        // Re-check minimum amount with actual available balance
        if (availableBalance < minimumAmount) {
          results.skipped++;
          continue;
        }

        // Process payout with the actual available amount
        const payoutResult = await processPayoutByStoreId({
          storeId: settings.storeId,
          amount: availableBalance,
          currency: balance.currency,
        });

        if (payoutResult.success) {
          // Get the actual payout date from the balance record
          const [updatedBalance] = await db
            .select({ lastPayoutAt: sellerBalances.lastPayoutAt })
            .from(sellerBalances)
            .where(eq(sellerBalances.storeId, settings.storeId))
            .limit(1);

          // Calculate next payout date using the actual payout date
          const nextPayoutAt = await calculateNextPayoutDate(
            settings.schedule as "weekly" | "biweekly" | "monthly" | null,
            settings.payoutDayOfWeek,
            settings.payoutDayOfMonth,
            updatedBalance?.lastPayoutAt || new Date() // Use actual payout date
          );

          // Update nextPayoutAt
          await db
            .update(sellerPayoutSettings)
            .set({ nextPayoutAt })
            .where(eq(sellerPayoutSettings.id, settings.id));

          console.log(
            `Successfully processed payout for store ${settings.storeId}. Next payout scheduled for ${nextPayoutAt.toISOString()}`
          );
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
