"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updatePayoutSettings } from "@/app/[locale]/actions/finances";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface PayoutScheduleSettingsProps {
  currentSettings: {
    method: "manual" | "automatic";
    schedule?: "daily" | "weekly" | "biweekly" | "monthly" | null;
    minimumAmount: number;
    payoutDayOfWeek?: number | null;
    payoutDayOfMonth?: number | null;
    holdPeriodDays?: number;
    nextPayoutAt?: Date | null;
  } | null;
  onSuccess?: () => void;
}

export function PayoutScheduleSettings({
  currentSettings,
  onSuccess,
}: PayoutScheduleSettingsProps) {
  const [method, setMethod] = useState<"manual" | "automatic">(
    currentSettings?.method || "manual"
  );
  const [schedule, setSchedule] = useState<
    "daily" | "weekly" | "biweekly" | "monthly" | null
  >(currentSettings?.schedule || null);
  const [payoutDayOfWeek, setPayoutDayOfWeek] = useState<number | null>(
    currentSettings?.payoutDayOfWeek ?? null
  );
  const [payoutDayOfMonth, setPayoutDayOfMonth] = useState<number | null>(
    currentSettings?.payoutDayOfMonth ?? null
  );
  const [minimumAmount, setMinimumAmount] = useState(
    currentSettings?.minimumAmount?.toString() || "20.00"
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updatePayoutSettings({
        method,
        schedule: method === "automatic" ? schedule : null,
        minimumAmount: parseFloat(minimumAmount),
        payoutDayOfWeek: schedule === "weekly" ? payoutDayOfWeek : null,
        payoutDayOfMonth: schedule === "monthly" ? payoutDayOfMonth : null,
      });

      if (result.success) {
        toast.success("Payout settings updated successfully");
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to update payout settings");
      }
    } catch (error) {
      toast.error("An error occurred while updating payout settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout Schedule</CardTitle>
        <CardDescription>
          Configure when and how you receive payouts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="method">Payout Method</Label>
            <Select
              value={method}
              onValueChange={(value) =>
                setMethod(value as "manual" | "automatic")
              }
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual (Request when needed)
                </SelectItem>
                <SelectItem value="automatic">Automatic (Scheduled)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "automatic" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule Frequency</Label>
                <Select
                  value={schedule || ""}
                  onValueChange={(value) =>
                    setSchedule(
                      value === "" ? null : (value as typeof schedule)
                    )
                  }
                >
                  <SelectTrigger id="schedule">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {schedule === "weekly" && (
                <div className="space-y-2">
                  <Label htmlFor="payoutDayOfWeek">Day of Week</Label>
                  <Select
                    value={payoutDayOfWeek?.toString() || ""}
                    onValueChange={(value) =>
                      setPayoutDayOfWeek(value === "" ? null : parseInt(value))
                    }
                  >
                    <SelectTrigger id="payoutDayOfWeek">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem
                          key={day.value}
                          value={day.value.toString()}
                        >
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {schedule === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="payoutDayOfMonth">Day of Month</Label>
                  <Input
                    id="payoutDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={payoutDayOfMonth?.toString() || ""}
                    onChange={(e) =>
                      setPayoutDayOfMonth(
                        e.target.value === "" ? null : parseInt(e.target.value)
                      )
                    }
                    placeholder="1-31"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a day of the month (1-31)
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="minimumAmount">Minimum Payout Amount</Label>
            <Input
              id="minimumAmount"
              type="number"
              step="0.01"
              min="0"
              value={minimumAmount}
              onChange={(e) => setMinimumAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum amount required before a payout can be processed
            </p>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
