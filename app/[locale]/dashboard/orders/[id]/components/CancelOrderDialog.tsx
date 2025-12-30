"use client";

import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cancelOrder } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  onSuccess: () => void;
}

const cancellationReasons = [
  "Customer requested cancellation",
  "Out of stock",
  "Payment issue",
  "Fraudulent order",
  "Duplicate order",
  "Shipping address issue",
  "Other",
];

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  totalAmount,
  currency,
  paymentStatus,
  fulfillmentStatus,
  onSuccess,
}: CancelOrderDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refundMethod, setRefundMethod] = useState<"original" | "later">(
    "original"
  );
  const [cancellationReason, setCancellationReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [sendNotification, setSendNotification] = useState(true);

  const isPaid =
    paymentStatus === "paid" || paymentStatus === "partially_refunded";
  const isUnfulfilled = fulfillmentStatus === "unfulfilled";
  const canRestock = isUnfulfilled;

  const handleSubmit = async () => {
    if (!cancellationReason) {
      toast.error("Please select a cancellation reason");
      return;
    }

    setLoading(true);
    try {
      const result = await cancelOrder({
        orderId,
        refundMethod,
        cancellationReason,
        internalNote: internalNote.trim() || null,
        restock: restock && canRestock,
        sendNotification,
      });

      if (result.success) {
        toast.success("Order cancelled successfully");
        onOpenChange(false);
        onSuccess();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel order");
      }
    } catch (error) {
      toast.error("Failed to cancel order");
      console.error("Cancel order error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancel Order #{orderNumber}</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this order? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Refund Payments Section */}
          {isPaid && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Refund Payments</Label>
              <div className="space-y-3 pl-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="refund-original"
                    checked={refundMethod === "original"}
                    onCheckedChange={(checked) => {
                      if (checked) setRefundMethod("original");
                    }}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="refund-original"
                      className="font-normal cursor-pointer"
                    >
                      Original payment method
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Refund {formatCurrency(totalAmount)} (
                      {paymentStatus === "paid" ? "Manual" : "Automatic"})
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="refund-later"
                    checked={refundMethod === "later"}
                    onCheckedChange={(checked) => {
                      if (checked) setRefundMethod("later");
                    }}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="refund-later"
                      className="font-normal cursor-pointer"
                    >
                      Later
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Your customer won&apos;t be refunded. Refund the amount
                      owed at a later point.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">
              Reason for Cancellation <span className="text-red-500">*</span>
            </Label>
            <Select
              value={cancellationReason}
              onValueChange={setCancellationReason}
            >
              <SelectTrigger id="cancellation-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {cancellationReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="internal-note">Internal Notes</Label>
            <Textarea
              id="internal-note"
              placeholder="Add any internal notes about this cancellation..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={4}
            />
          </div>

          {/* Restock Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="restock"
              checked={restock}
              onCheckedChange={(checked) => setRestock(checked as boolean)}
              disabled={!canRestock}
            />
            <div className="flex-1">
              <Label htmlFor="restock" className="font-normal cursor-pointer">
                Restock
              </Label>
              <p className="text-sm text-muted-foreground">
                {canRestock
                  ? "Return items to inventory"
                  : "Cannot restock fulfilled orders"}
              </p>
            </div>
          </div>

          {/* Send Notification Checkbox */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="send-notification"
              checked={sendNotification}
              onCheckedChange={(checked) =>
                setSendNotification(checked as boolean)
              }
            />
            <div className="flex-1">
              <Label
                htmlFor="send-notification"
                className="font-normal cursor-pointer"
              >
                Send a notification to customer
              </Label>
              <p className="text-sm text-muted-foreground">
                Send an email notification to the customer about this
                cancellation
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !cancellationReason}
          >
            {loading ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
