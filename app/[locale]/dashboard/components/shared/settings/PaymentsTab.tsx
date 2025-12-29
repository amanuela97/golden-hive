"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  checkStripePaymentReadiness,
  createStripeAccountAndOnboarding,
  generateOnboardingLink,
  createStripeDashboardLink,
} from "@/app/[locale]/actions/stripe-connect";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import toast from "react-hot-toast";
import { Link } from "@/i18n/navigation";

export default function PaymentsTab() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{
    hasStore: boolean;
    hasStripeAccount: boolean;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    stripeOnboardingComplete: boolean;
  } | null>(null);
  const [paymentReadiness, setPaymentReadiness] = useState<{
    isReady: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null>(null);
  const [loadingDashboardLink, setLoadingDashboardLink] = useState(false);

  useEffect(() => {
    loadStatus();

    // Check for success or refresh parameters
    const success = searchParams.get("success");
    const refresh = searchParams.get("refresh");

    if (success === "true") {
      toast.success("Stripe onboarding completed successfully!");
      // Reload status after a short delay
      setTimeout(() => {
        loadStatus();
      }, 1000);
    } else if (refresh === "true") {
      toast("Please complete your Stripe onboarding");
    }
  }, [searchParams]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [setup, readiness] = await Promise.all([
        getStoreSetupStatus(),
        checkStripePaymentReadiness(),
      ]);

      setSetupStatus({
        hasStore: setup.hasStore,
        hasStripeAccount: setup.hasStripeAccount,
        stripeChargesEnabled: setup.stripeChargesEnabled,
        stripePayoutsEnabled: setup.stripePayoutsEnabled,
        stripeOnboardingComplete: setup.stripeOnboardingComplete,
      });

      if (readiness.error !== "No Stripe account connected") {
        setPaymentReadiness(readiness);
      }
    } catch (error) {
      console.error("Error loading status:", error);
      toast.error("Failed to load payment status");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const result = await createStripeAccountAndOnboarding();
      if (result.success && result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      } else {
        toast.error(result.error || "Failed to connect Stripe");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      toast.error("Failed to connect Stripe");
    } finally {
      setConnecting(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setConnecting(true);
    try {
      const result = await generateOnboardingLink();
      if (result.success && result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      } else {
        toast.error(result.error || "Failed to generate onboarding link");
      }
    } catch (error) {
      console.error("Error generating onboarding link:", error);
      toast.error("Failed to generate onboarding link");
    } finally {
      setConnecting(false);
    }
  };

  const handleViewEarnings = async () => {
    setLoadingDashboardLink(true);
    try {
      const result = await createStripeDashboardLink();
      if (result.success && result.url) {
        window.open(result.url, "_blank");
      } else {
        toast.error(result.error || "Failed to open Stripe dashboard");
      }
    } catch (error) {
      console.error("Error opening Stripe dashboard:", error);
      toast.error("Failed to open Stripe dashboard");
    } finally {
      setLoadingDashboardLink(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </Card>
      </div>
    );
  }

  if (!setupStatus?.hasStore) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Store Setup Required</AlertTitle>
          <AlertDescription>
            Please set up your store first before connecting Stripe.
            <Button asChild variant="link" className="p-0 ml-1 h-auto">
              <Link href="/dashboard/settings/store">Go to Store Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isReady = paymentReadiness?.isReady || false;
  const needsOnboarding = setupStatus.hasStripeAccount && !isReady;

  return (
    <div className="space-y-6">
      {!setupStatus.hasStripeAccount ? (
        <Card className="p-8">
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <h4 className="text-lg font-medium text-gray-900">
                Connect Stripe to Receive Payments
              </h4>
              <p className="text-gray-600 max-w-md mx-auto">
                Connect your Stripe account to start accepting payments.
                You&apos;ll be redirected to Stripe to complete the setup.
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleConnectStripe}
                disabled={connecting}
                size="lg"
                className="gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Connect Stripe
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      ) : needsOnboarding ? (
        <Card className="p-8">
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Complete Stripe Onboarding</AlertTitle>
              <AlertDescription>
                Your Stripe account is connected but onboarding is not complete.
                You need to finish setup to receive payments.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {paymentReadiness?.chargesEnabled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span
                  className={
                    paymentReadiness?.chargesEnabled
                      ? "text-green-600"
                      : "text-gray-600"
                  }
                >
                  Charges{" "}
                  {paymentReadiness?.chargesEnabled ? "Enabled" : "Not Enabled"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {paymentReadiness?.payoutsEnabled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                )}
                <span
                  className={
                    paymentReadiness?.payoutsEnabled
                      ? "text-green-600"
                      : "text-gray-600"
                  }
                >
                  Payouts{" "}
                  {paymentReadiness?.payoutsEnabled ? "Enabled" : "Not Enabled"}
                </span>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleContinueOnboarding}
                disabled={connecting}
                size="lg"
                variant="default"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Continue Onboarding"
                )}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              <h4 className="text-lg font-medium">Stripe Account Connected</h4>
            </div>
            <p className="text-gray-600">
              Your Stripe account is fully set up and ready to receive payments.
            </p>
            <div className="space-y-2 pt-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span>Charges Enabled</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span>Payouts Enabled</span>
              </div>
            </div>
            {setupStatus.hasStripeAccount && (
              <div className="pt-4">
                <Button
                  onClick={handleViewEarnings}
                  disabled={loadingDashboardLink}
                  variant="outline"
                  className="gap-2"
                >
                  {loadingDashboardLink ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      View Earnings
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
