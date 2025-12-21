"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { processRefund } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { AlertCircle } from "lucide-react";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  totalAmount: string;
  refundedAmount: string;
  currency: string;
  fulfillmentStatus: string;
  onSuccess: () => void;
}

export function RefundDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  totalAmount,
  refundedAmount,
  currency,
  fulfillmentStatus,
  onSuccess,
}: RefundDialogProps) {
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [restockItems, setRestockItems] = useState(
    fulfillmentStatus === "unfulfilled"
  );
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const totalPaid = parseFloat(totalAmount);
  const alreadyRefunded = parseFloat(refundedAmount);
  const maxRefundable = totalPaid - alreadyRefunded;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (refundType === "partial") {
      const amount = parseFloat(refundAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Please enter a valid refund amount");
        return;
      }
      if (amount > maxRefundable) {
        toast.error(
          `Refund amount cannot exceed ${maxRefundable.toFixed(2)} ${currency}`
        );
        return;
      }
    }

    setProcessing(true);
    try {
      const result = await processRefund({
        orderId,
        refundType,
        amount: refundType === "full" ? undefined : refundAmount,
        restockItems,
        reason: reason || undefined,
      });

      if (result.success) {
        toast.success("Refund processed successfully");
        onSuccess();
        onOpenChange(false);
        // Reset form
        setRefundType("full");
        setRefundAmount("");
        setRestockItems(fulfillmentStatus === "unfulfilled");
        setReason("");
      } else {
        toast.error(result.error || "Failed to process refund");
      }
    } catch (error) {
      toast.error("An error occurred while processing the refund");
      console.error("Refund error:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Refund Order #{orderNumber}</DialogTitle>
          <DialogDescription>
            Process a refund for this order. The customer will receive their
            money back.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Refund Type */}
          <div className="space-y-2">
            <Label htmlFor="refundType">Refund Type</Label>
            <Select
              value={refundType}
              onValueChange={(value) => {
                setRefundType(value as "full" | "partial");
                if (value === "full") {
                  setRefundAmount("");
                }
              }}
            >
              <SelectTrigger id="refundType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Refund</SelectItem>
                <SelectItem value="partial">Partial Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Partial Refund Amount */}
          {refundType === "partial" && (
            <div className="space-y-2">
              <Label htmlFor="refundAmount">Refund Amount ({currency})</Label>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={maxRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter refund amount"
                required={refundType === "partial"}
              />
              <p className="text-sm text-muted-foreground">
                Maximum refundable: {maxRefundable.toFixed(2)} {currency}
              </p>
            </div>
          )}

          {/* Refund Summary */}
          <div className="rounded-lg border p-3 space-y-1 bg-muted/50">
            <div className="flex justify-between text-sm">
              <span>Total Paid:</span>
              <span className="font-medium">
                {totalPaid.toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Already Refunded:</span>
              <span className="font-medium">
                {alreadyRefunded.toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1 border-t">
              <span>
                {refundType === "full" ? "Refund Amount:" : "This Refund:"}
              </span>
              <span>
                {refundType === "full"
                  ? `${maxRefundable.toFixed(2)} ${currency}`
                  : refundAmount
                    ? `${parseFloat(refundAmount).toFixed(2)} ${currency}`
                    : `0.00 ${currency}`}
              </span>
            </div>
          </div>

          {/* Restock Items */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="restockItems"
              checked={restockItems}
              onCheckedChange={(checked) => setRestockItems(checked === true)}
            />
            <Label
              htmlFor="restockItems"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Restock items to inventory
            </Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2 ml-6">
            {fulfillmentStatus === "unfulfilled"
              ? "Recommended: Items will be returned to inventory"
              : "Items have been fulfilled. Only restock if items are returned."}
          </p>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_request">
                  Customer Request
                </SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Warning */}
          {refundType === "full" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This will refund the full amount of {maxRefundable.toFixed(2)}{" "}
                {currency} to the customer.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={processing}>
              {processing ? "Processing..." : "Process Refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
