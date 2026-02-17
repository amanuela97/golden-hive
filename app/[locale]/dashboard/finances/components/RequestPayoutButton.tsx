"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPayout } from "@/app/[locale]/actions/seller-payouts";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface RequestPayoutButtonProps {
  availableBalance: number;
  currency: string;
  minimumAmount: number;
  onSuccess?: () => void;
  /** e.g. "Stripe" or "eSewa (Nepal)" – shown in the dialog so user knows how they receive the payout */
  payoutMethodLabel?: string;
}

export function RequestPayoutButton({
  availableBalance,
  currency,
  minimumAmount,
  onSuccess,
  payoutMethodLabel,
}: RequestPayoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canRequestPayout =
    availableBalance >= minimumAmount && availableBalance > 0;

  const handleRequest = async () => {
    const payoutAmount = parseFloat(amount);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (payoutAmount < minimumAmount) {
      toast.error(
        `Minimum payout amount is ${formatCurrency(minimumAmount, currency)}`
      );
      return;
    }

    if (payoutAmount > availableBalance) {
      toast.error(
        `Insufficient balance. Available: ${formatCurrency(
          availableBalance,
          currency
        )}`
      );
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPayout({
        amount: payoutAmount,
        currency,
      });

      if (result.success) {
        toast.success(
          (result as { message?: string }).message ||
            "Payout request submitted successfully"
        );
        setOpen(false);
        setAmount("");
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to request payout");
      }
    } catch (error) {
      toast.error("An error occurred while requesting payout");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canRequestPayout} className="w-full sm:w-auto">
          Request Payout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Payout</DialogTitle>
          <DialogDescription>
            Request a payout from your available balance.
            {payoutMethodLabel && (
              <span className="mt-1 block font-medium text-foreground">
                Payout method: {payoutMethodLabel}
              </span>
            )}
            <span className="mt-1 block">
              Minimum amount: {formatCurrency(minimumAmount, currency)}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={minimumAmount}
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max: ${formatCurrency(availableBalance, currency)}`}
            />
            <p className="text-xs text-muted-foreground">
              Available: {formatCurrency(availableBalance, currency)}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Summary</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Requested Amount:</span>
                <span className="font-medium">
                  {amount
                    ? formatCurrency(parseFloat(amount) || 0, currency)
                    : formatCurrency(0, currency)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Remaining Balance:</span>
                <span>
                  {amount
                    ? formatCurrency(
                        availableBalance - (parseFloat(amount) || 0),
                        currency
                      )
                    : formatCurrency(availableBalance, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRequest} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
