"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Store, CreditCard } from "lucide-react";
import Link from "next/link";

interface SetupBannerProps {
  missingStore?: boolean;
  missingStripe?: boolean;
  stripeNotReady?: boolean;
}

export function SetupBanner({
  missingStore,
  missingStripe,
  stripeNotReady,
}: SetupBannerProps) {
  if (missingStore) {
    return (
      <Alert className="mb-6 border-yellow-500 bg-yellow-50">
        <Store className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">
          Store Setup Required
        </AlertTitle>
        <AlertDescription className="text-yellow-700">
          You need to set up your store before you can{" "}
          {missingStripe ? "add products and " : ""}create orders.
          <Button
            asChild
            variant="link"
            className="p-0 ml-1 h-auto text-yellow-800 underline"
          >
            <Link href="/dashboard/settings/store">Set up your store</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (missingStripe || stripeNotReady) {
    return (
      <Alert className="mb-6 border-yellow-500 bg-yellow-50">
        <CreditCard className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800">
          {missingStripe
            ? "Stripe Payment Setup Required"
            : "Complete Stripe Onboarding"}
        </AlertTitle>
        <AlertDescription className="text-yellow-700">
          {missingStripe
            ? "You need to connect your Stripe account to receive payments and create orders."
            : "You need to complete your Stripe onboarding to receive payments."}
          <Button
            asChild
            variant="link"
            className="p-0 ml-1 h-auto text-yellow-800 underline"
          >
            <Link href="/dashboard/settings/payments">
              {missingStripe ? "Connect Stripe" : "Continue Onboarding"}
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
