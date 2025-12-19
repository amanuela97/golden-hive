"use client";

import { useState, useEffect } from "react";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import { checkStripePaymentReadiness } from "@/app/[locale]/actions/stripe-connect";

let cachedStatus: {
  setup: Awaited<ReturnType<typeof getStoreSetupStatus>> | null;
  readiness: Awaited<ReturnType<typeof checkStripePaymentReadiness>> | null;
  timestamp: number;
} = {
  setup: null,
  readiness: null,
  timestamp: 0,
};

const CACHE_DURATION = 5000; // 5 seconds

export function useSetupStatus() {
  const [status, setStatus] = useState(cachedStatus);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = Date.now();
    const isStale = now - cachedStatus.timestamp > CACHE_DURATION;

    if (!isStale && cachedStatus.setup && cachedStatus.readiness) {
      setStatus(cachedStatus);
      setLoading(false);
      return;
    }

    const loadStatus = async () => {
      try {
        const [setup, readiness] = await Promise.all([
          getStoreSetupStatus(),
          checkStripePaymentReadiness(),
        ]);

        cachedStatus = {
          setup,
          readiness,
          timestamp: Date.now(),
        };

        setStatus(cachedStatus);
      } catch (error) {
        console.error("Error loading setup status:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  return { ...status, loading };
}
