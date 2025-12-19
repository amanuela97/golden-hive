"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Store, CreditCard } from "lucide-react";
import Link from "next/link";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import { useEffect, useState } from "react";

export function DashboardSetupTodo() {
  const [status, setStatus] = useState<{
    hasStore: boolean;
    hasStripeAccount: boolean;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const setupStatus = await getStoreSetupStatus();
      console.log("DashboardSetupTodo - Setup status:", setupStatus);
      setStatus(setupStatus);
    } catch (error) {
      console.error("Error loading setup status:", error);
      // Set default status on error so component still renders
      setStatus({
        hasStore: false,
        hasStripeAccount: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-5 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  // Show if anything is missing
  const storeComplete = status.hasStore;
  const stripeComplete = status.hasStripeAccount && status.stripeChargesEnabled && status.stripePayoutsEnabled;
  
  // Don't show if everything is set up
  if (storeComplete && stripeComplete) {
    console.log("DashboardSetupTodo - Everything is set up, hiding component");
    return null;
  }
  
  console.log("DashboardSetupTodo - Showing component", { storeComplete, stripeComplete, status });

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Setup Checklist</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {storeComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <div className="flex-1">
            <Link
              href="/dashboard/settings/store"
              className={storeComplete ? "text-green-600" : "text-gray-700 hover:text-gray-900"}
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                <span>Set up your store</span>
              </div>
            </Link>
            {!storeComplete && (
              <p className="text-sm text-gray-500 ml-6">Required to add products and start selling</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stripeComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <div className="flex-1">
            <Link
              href="/dashboard/settings/payments"
              className={stripeComplete ? "text-green-600" : "text-gray-700 hover:text-gray-900"}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Set up Stripe payment account</span>
              </div>
            </Link>
            {!stripeComplete && (
              <p className="text-sm text-gray-500 ml-6">Required to sell products and get paid</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

