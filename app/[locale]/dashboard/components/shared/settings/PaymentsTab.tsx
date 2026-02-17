"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import {
  checkStripePaymentReadiness,
  createStripeAccountAndOnboarding,
  generateOnboardingLink,
  createStripeDashboardLink,
} from "@/app/[locale]/actions/stripe-connect";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import {
  getStore,
  updateStorePayoutProvider,
  updateStoreBankDetails,
} from "@/app/[locale]/actions/storefront-management";
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

  const [storeId, setStoreId] = useState<string | null>(null);
  const [payoutProvider, setPayoutProvider] = useState<"stripe" | "esewa">(
    "stripe"
  );
  const [esewaId, setEsewaId] = useState("");
  const [storedEsewaId, setStoredEsewaId] = useState("");
  const [esewaIdRevealed, setEsewaIdRevealed] = useState(false);
  const [savingPayoutMethod, setSavingPayoutMethod] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [bankAccountMasked, setBankAccountMasked] = useState<string | null>(null);
  const [bankAccountHolderName, setBankAccountHolderName] = useState("");
  const [bankBankName, setBankBankName] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountNumberConfirm, setBankAccountNumberConfirm] = useState("");
  const [savingBank, setSavingBank] = useState(false);

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
      const [setup, readiness, storeResult] = await Promise.all([
        getStoreSetupStatus(),
        checkStripePaymentReadiness(),
        getStore(),
      ]);

      setSetupStatus({
        hasStore: setup.hasStore,
        hasStripeAccount: setup.hasStripeAccount,
        stripeChargesEnabled: setup.stripeChargesEnabled,
        stripePayoutsEnabled: setup.stripePayoutsEnabled,
        stripeOnboardingComplete: setup.stripeOnboardingComplete,
      });

      if (setup.storeId) {
        setStoreId(setup.storeId);
      }
      if (storeResult.success && storeResult.result) {
        const s = storeResult.result as {
          payoutProvider?: string;
          esewaId?: string;
          hasBankDetails?: boolean;
          bankAccountMasked?: string | null;
        };
        setPayoutProvider((s.payoutProvider as "stripe" | "esewa") || "stripe");
        setStoredEsewaId(s.esewaId ?? "");
        setEsewaId("");
        setHasBankDetails(!!s.hasBankDetails);
        setBankAccountMasked(s.bankAccountMasked ?? null);
      }

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

  const handleSavePayoutMethod = async () => {
    if (!storeId) return;
    setSavingPayoutMethod(true);
    try {
      const valueToSave =
        payoutProvider === "esewa" ? (esewaId?.trim() || storedEsewaId || null) : null;
      const result = await updateStorePayoutProvider(storeId, {
        payoutProvider: payoutProvider,
        esewaId: valueToSave,
      });
      if (result.success) {
        toast.success("Payout method updated");
        setEsewaId("");
        if (payoutProvider === "esewa" && valueToSave) {
          setStoredEsewaId(valueToSave);
        }
        setEsewaIdRevealed(false);
        loadStatus();
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update payout method");
    } finally {
      setSavingPayoutMethod(false);
    }
  };

  const handleSaveBank = async () => {
    if (!storeId) return;
    if (bankAccountNumber !== bankAccountNumberConfirm) {
      toast.error("Account numbers do not match");
      return;
    }
    if (!bankAccountHolderName.trim() || !bankBankName.trim() || !bankAccountNumber.trim()) {
      toast.error("Account holder name, bank name, and account number are required");
      return;
    }
    setSavingBank(true);
    try {
      const result = await updateStoreBankDetails(storeId, {
        accountHolderName: bankAccountHolderName.trim(),
        bankName: bankBankName.trim(),
        branchName: bankBranchName.trim(),
        accountNumber: bankAccountNumber.trim(),
      });
      if (result.success) {
        toast.success("Bank details saved");
        setHasBankDetails(true);
        setBankAccountMasked("****" + bankAccountNumber.slice(-4));
        setBankAccountNumber("");
        setBankAccountNumberConfirm("");
        loadStatus();
      } else {
        toast.error(result.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save bank details");
    } finally {
      setSavingBank(false);
    }
  };

  const handleClearBank = async () => {
    if (!storeId) return;
    setSavingBank(true);
    try {
      const result = await updateStoreBankDetails(storeId, null);
      if (result.success) {
        toast.success("Bank details removed");
        setHasBankDetails(false);
        setBankAccountMasked(null);
        setBankAccountHolderName("");
        setBankBankName("");
        setBankBranchName("");
        setBankAccountNumber("");
        setBankAccountNumberConfirm("");
        loadStatus();
      } else {
        toast.error(result.error || "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove bank details");
    } finally {
      setSavingBank(false);
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
      {storeId && (
        <Card className="p-8">
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">
              Payout method
            </h4>
            <p className="text-gray-600 text-sm">
              Choose how you receive payouts. Stripe: to your connected Stripe
              account. eSewa: manual transfer to your eSewa ID (Nepal).
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutProvider("stripe")}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    payoutProvider === "stripe"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Stripe
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutProvider("esewa")}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    payoutProvider === "esewa"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  eSewa (Nepal)
                </button>
              </div>
              {payoutProvider === "esewa" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="esewaId">eSewa ID</Label>
                  <Input
                    id="esewaId"
                    value={esewaId}
                    onChange={(e) => setEsewaId(e.target.value)}
                    placeholder="Your eSewa wallet ID"
                    className="max-w-xs"
                  />
                </div>
              )}
              <Button
                onClick={handleSavePayoutMethod}
                disabled={savingPayoutMethod}
                size="sm"
              >
                {savingPayoutMethod ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {storeId && (
        <Card className="p-8">
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">
              Bank account (optional for NPR payouts)
            </h4>
            <p className="text-gray-600 text-sm">
              Add your Nepal bank details as an alternative to eSewa. Admin can
              use this to transfer NPR payouts if you don&apos;t use eSewa. Stored
              securely and never shown in full.
            </p>
            {hasBankDetails && bankAccountMasked ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 max-w-md">
                <span className="font-mono text-sm">{bankAccountMasked}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearBank}
                  disabled={savingBank}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 max-w-md">
                <div>
                  <Label htmlFor="bankHolder">Account holder name</Label>
                  <Input
                    id="bankHolder"
                    value={bankAccountHolderName}
                    onChange={(e) => setBankAccountHolderName(e.target.value)}
                    placeholder="As registered at bank"
                  />
                </div>
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input
                    id="bankName"
                    value={bankBankName}
                    onChange={(e) => setBankBankName(e.target.value)}
                    placeholder="e.g. NIC Asia, Nabil Bank"
                  />
                </div>
                <div>
                  <Label htmlFor="bankBranch">Branch name (optional)</Label>
                  <Input
                    id="bankBranch"
                    value={bankBranchName}
                    onChange={(e) => setBankBranchName(e.target.value)}
                    placeholder="Branch name"
                  />
                </div>
                <div>
                  <Label htmlFor="bankAccount">Account number</Label>
                  <Input
                    id="bankAccount"
                    type="text"
                    inputMode="numeric"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter account number"
                  />
                </div>
                <div>
                  <Label htmlFor="bankAccountConfirm">Confirm account number</Label>
                  <Input
                    id="bankAccountConfirm"
                    type="text"
                    inputMode="numeric"
                    value={bankAccountNumberConfirm}
                    onChange={(e) => setBankAccountNumberConfirm(e.target.value.replace(/\D/g, ""))}
                    placeholder="Re-enter account number"
                  />
                </div>
                <Button onClick={handleSaveBank} disabled={savingBank} size="sm">
                  {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save bank details"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

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
      ) : payoutProvider === "esewa" ? (
        <Card className="p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              <h4 className="text-lg font-medium">eSewa ID</h4>
            </div>
            <p className="text-gray-600">
              Payouts will be sent to your eSewa wallet. Update the ID above and
              save to change it.
            </p>
            {storedEsewaId ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 max-w-md">
                <span className="font-mono text-sm truncate flex-1 min-w-0">
                  {esewaIdRevealed ? storedEsewaId : "*".repeat(Math.min(storedEsewaId.length, 12))}
                </span>
                <button
                  type="button"
                  onClick={() => setEsewaIdRevealed((v) => !v)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={esewaIdRevealed ? "Hide" : "Show"}
                >
                  {esewaIdRevealed ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(storedEsewaId);
                    toast.success("Copied to clipboard");
                  }}
                  className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No eSewa ID saved yet. Enter your eSewa wallet ID above and
                click Save.
              </p>
            )}
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
