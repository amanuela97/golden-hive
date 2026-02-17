"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import { useState } from "react";
import type { WalletSummary } from "@/app/[locale]/actions/finances";

interface BalanceSummaryProps {
  /** Two wallets: EUR (Stripe) and NPR (eSewa) */
  wallets: { EUR: WalletSummary; NPR: WalletSummary };
  holdPeriodDays?: number;
}

function InfoTooltip({ content }: { content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center justify-center cursor-help focus:outline-none hover:opacity-70 transition-opacity"
        aria-label="Information"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <Info className="h-4 w-4 text-muted-foreground" />
      </button>
      {isVisible && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none"
      
        >
          <p className="whitespace-normal leading-relaxed">{content}</p>
          <div
            className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
            style={{ transform: "translateX(-50%)" }}
          />
        </div>
      )}
    </div>
  );
}

export function BalanceSummary({
  wallets,
  holdPeriodDays = 7,
}: BalanceSummaryProps) {
  const { EUR, NPR } = wallets;
  const holdPeriodText = holdPeriodDays === 1
    ? "1 day"
    : `${holdPeriodDays} days`;
  const showReservedEur = EUR.reservedFeesFromPending > 0;
  const showReservedNpr = NPR.reservedFeesFromPending > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          <InfoTooltip content="Your total net balance including all available funds, pending funds, and any amounts you owe. Calculated as: Available + Pending - Amount Due." />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(EUR.currentBalance, "EUR")}</div>
          <div className="text-lg font-semibold text-muted-foreground mt-1">{formatCurrency(NPR.currentBalance, "NPR")}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Available for Deposit</CardTitle>
          <InfoTooltip content="Funds that are ready to be withdrawn. EUR via Stripe; NPR via eSewa." />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(EUR.availableBalance, "EUR")}</div>
          <div className="text-lg font-semibold text-green-600 mt-1">{formatCurrency(NPR.availableBalance, "NPR")}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending (on hold)</CardTitle>
          <InfoTooltip content={`Funds in a hold period of ${holdPeriodText}. They will move to Available after the hold expires.`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{formatCurrency(EUR.pendingBalance, "EUR")}</div>
          <div className="text-lg font-semibold text-yellow-600 mt-1">{formatCurrency(NPR.pendingBalance, "NPR")}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Amount Due / Reserved</CardTitle>
          <InfoTooltip content="Outstanding costs or fees reserved from pending. Deducted from future payouts." />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">
            {showReservedEur ? formatCurrency(EUR.reservedFeesFromPending, "EUR") : formatCurrency(EUR.amountDue, "EUR")}
          </div>
          <div className="text-lg font-semibold text-muted-foreground mt-1">
            {showReservedNpr ? formatCurrency(NPR.reservedFeesFromPending, "NPR") : formatCurrency(NPR.amountDue, "NPR")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
