"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

interface PayoutScheduleInfoProps {
  nextPayoutAt: Date | null;
  lastPayoutAt: Date | null;
  lastPayoutAmount: number | null;
  schedule: "daily" | "weekly" | "biweekly" | "monthly" | null;
  currency: string;
}

export function PayoutScheduleInfo({
  nextPayoutAt,
  lastPayoutAt,
  lastPayoutAmount,
  schedule,
  currency,
}: PayoutScheduleInfoProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatRelativeDate = (date: Date | null) => {
    if (!date) return "N/A";
    const now = new Date();
    const payoutDate = new Date(date);
    const diffMs = payoutDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else {
      return `In ${diffDays} days`;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Next Scheduled Payout</CardTitle>
          </div>
          <CardDescription>
            {schedule
              ? `Automatic ${schedule} payout`
              : "No automatic schedule set"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nextPayoutAt ? (
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {formatRelativeDate(nextPayoutAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(nextPayoutAt)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No scheduled payout</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Last Payout</CardTitle>
          </div>
          <CardDescription>Most recent payout information</CardDescription>
        </CardHeader>
        <CardContent>
          {lastPayoutAt ? (
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {lastPayoutAmount
                  ? formatCurrency(lastPayoutAmount, currency)
                  : "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(lastPayoutAt)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No previous payouts</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
