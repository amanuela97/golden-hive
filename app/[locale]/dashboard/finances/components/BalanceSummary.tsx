"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import { useState } from "react";

interface BalanceSummaryProps {
  availableBalance: number;
  pendingBalance: number;
  amountDue: number;
  /** When > 0, show as "Reserved (fees)" with tooltip that it's covered by pending (not a debt) */
  reservedFeesFromPending?: number;
  currentBalance: number;
  currency: string;
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
  availableBalance,
  pendingBalance,
  amountDue,
  reservedFeesFromPending = 0,
  currentBalance,
  currency,
  holdPeriodDays = 7,
}: BalanceSummaryProps) {
  const holdPeriodText = holdPeriodDays === 1 
    ? "1 day" 
    : `${holdPeriodDays} days`;

  const showReservedFees = reservedFeesFromPending > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          <InfoTooltip content="Your total net balance including all available funds, pending funds, and any amounts you owe. Calculated as: Available + Pending - Amount Due." />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(currentBalance, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Available for Deposit
          </CardTitle>
          <InfoTooltip content="Funds that are ready to be withdrawn immediately. These funds have completed the hold period and can be transferred to your bank account via payout." />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(availableBalance, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending (on hold)
          </CardTitle>
          <InfoTooltip content={`Funds from recent orders that are currently in a hold period of ${holdPeriodText}. These funds will automatically move to Available for Deposit after the hold period expires. This hold period helps protect against chargebacks and disputes.`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(pendingBalance, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {showReservedFees ? "Reserved (fees)" : "Amount Due"}
          </CardTitle>
          <InfoTooltip
            content={
              showReservedFees
                ? "Fees from recent orders held against your pending balance. This amount is covered by pending funds and will be settled automatically when the hold period ends. You do not owe this separately."
                : "Outstanding costs that you owe to the platform, such as transaction fees, shipping costs, or other charges. This amount will be deducted from your future payouts or available balance."
            }
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              showReservedFees
                ? "text-muted-foreground"
                : amountDue > 0
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {formatCurrency(
              showReservedFees ? reservedFeesFromPending : amountDue,
              currency
            )}
          </div>
          {showReservedFees && (
            <p className="text-xs text-muted-foreground mt-1">
              Covered by pending
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
