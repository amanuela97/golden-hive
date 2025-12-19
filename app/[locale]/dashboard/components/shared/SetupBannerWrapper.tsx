"use client";

import { useEffect, useState } from "react";
import { SetupBanner } from "./SetupBanner";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import { checkStripePaymentReadiness } from "@/app/[locale]/actions/stripe-connect";

export function SetupBannerWrapper() {
  const [setupStatus, setSetupStatus] = useState<{
    hasStore: boolean;
    hasStripeAccount: boolean;
  } | null>(null);
  const [paymentReadiness, setPaymentReadiness] = useState<{
    isReady: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const [setup, readiness] = await Promise.all([
        getStoreSetupStatus(),
        checkStripePaymentReadiness(),
      ]);

      console.log("SetupBannerWrapper - Setup status:", setup);
      console.log("SetupBannerWrapper - Payment readiness:", readiness);

      setSetupStatus({
        hasStore: setup.hasStore,
        hasStripeAccount: setup.hasStripeAccount,
      });

      if (readiness.error !== "No Stripe account connected") {
        setPaymentReadiness(readiness);
      } else {
        // If no Stripe account, set readiness to not ready
        setPaymentReadiness({ isReady: false });
      }
    } catch (error) {
      console.error("Error loading setup status:", error);
      // Set default status on error so banner still shows
      setSetupStatus({
        hasStore: false,
        hasStripeAccount: false,
      });
      setPaymentReadiness({ isReady: false });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show loading state for banner
  }

  if (!setupStatus) {
    return null;
  }

  const missingStore = !setupStatus.hasStore;
  const missingStripe = !setupStatus.hasStripeAccount;
  const stripeNotReady = setupStatus.hasStripeAccount && !paymentReadiness?.isReady;

  return (
    <SetupBanner
      missingStore={missingStore}
      missingStripe={missingStripe}
      stripeNotReady={stripeNotReady}
    />
  );
}

