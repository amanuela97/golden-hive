"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BalanceSummaryProps {
  availableBalance: number;
  pendingBalance: number;
  amountDue: number;
  currentBalance: number;
  currency: string;
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center cursor-help focus:outline-none hover:opacity-70 transition-opacity"
          aria-label="Information"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <p className="whitespace-normal text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function BalanceSummary({
  availableBalance,
  pendingBalance,
  amountDue,
  currentBalance,
  currency,
}: BalanceSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          <InfoTooltip content="Net balance (Available + Pending - Amount Due)" />
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
          <InfoTooltip content="Funds that can be withdrawn immediately" />
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
          <InfoTooltip content="Funds still in hold period or under review" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(pendingBalance, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Amount Due</CardTitle>
          <InfoTooltip content="Costs that you owe the platform" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              amountDue > 0 ? "text-red-600" : "text-muted-foreground"
            }`}
          >
            {formatCurrency(amountDue, currency)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
