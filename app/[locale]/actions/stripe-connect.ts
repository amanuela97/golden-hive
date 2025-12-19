"use server";

import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { store } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStoreIdForUser } from "./store-members";

/**
 * Check if Stripe account is ready to receive payments
 */
export async function checkStripePaymentReadiness(): Promise<{
  isReady: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  error?: string;
}> {
  try {
    const { storeId } = await getStoreIdForUser();

    if (!storeId) {
      return {
        isReady: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        error: "No store found",
      };
    }

    const storeData = await db
      .select({
        stripeAccountId: store.stripeAccountId,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeData.length === 0 || !storeData[0].stripeAccountId) {
      return {
        isReady: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        error: "No Stripe account connected",
      };
    }

    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(storeData[0].stripeAccountId);

    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;
    const detailsSubmitted = account.details_submitted || false;

    // Update store with current status
    await db
      .update(store)
      .set({
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
        stripeOnboardingComplete: detailsSubmitted && chargesEnabled && payoutsEnabled,
        updatedAt: new Date(),
      })
      .where(eq(store.id, storeId));

    return {
      isReady: chargesEnabled && payoutsEnabled,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    };
  } catch (error) {
    console.error("Error checking Stripe payment readiness:", error);
    return {
      isReady: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      error: error instanceof Error ? error.message : "Failed to check payment readiness",
    };
  }
}

/**
 * Create Stripe account and generate onboarding link
 */
export async function createStripeAccountAndOnboarding(): Promise<{
  success: boolean;
  onboardingUrl?: string;
  error?: string;
}> {
  try {
    const { storeId } = await getStoreIdForUser();

    if (!storeId) {
      return {
        success: false,
        error: "No store found. Please set up your store first.",
      };
    }

    // Check if account already exists
    const storeData = await db
      .select({
        stripeAccountId: store.stripeAccountId,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    let stripeAccountId: string;

    if (storeData.length > 0 && storeData[0].stripeAccountId) {
      stripeAccountId = storeData[0].stripeAccountId;
    } else {
      // Create new Stripe Express account
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // Save to database
      await db
        .update(store)
        .set({
          stripeAccountId: account.id,
          updatedAt: new Date(),
        })
        .where(eq(store.id, storeId));
    }

    // Generate onboarding link
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments?success=true`,
      type: "account_onboarding",
    });

    return {
      success: true,
      onboardingUrl: link.url,
    };
  } catch (error) {
    console.error("Error creating Stripe account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create Stripe account",
    };
  }
}

/**
 * Generate onboarding link for existing account
 */
export async function generateOnboardingLink(): Promise<{
  success: boolean;
  onboardingUrl?: string;
  error?: string;
}> {
  try {
    const { storeId } = await getStoreIdForUser();

    if (!storeId) {
      return {
        success: false,
        error: "No store found",
      };
    }

    const storeData = await db
      .select({
        stripeAccountId: store.stripeAccountId,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeData.length === 0 || !storeData[0].stripeAccountId) {
      return {
        success: false,
        error: "No Stripe account connected",
      };
    }

    const link = await stripe.accountLinks.create({
      account: storeData[0].stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments?success=true`,
      type: "account_onboarding",
    });

    return {
      success: true,
      onboardingUrl: link.url,
    };
  } catch (error) {
    console.error("Error generating onboarding link:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate onboarding link",
    };
  }
}

