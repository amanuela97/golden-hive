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
import { Textarea } from "@/components/ui/textarea";
import { cancelOrderByCustomer } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";

interface CancelOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  fulfillmentStatus: string;
  onSuccess?: () => void;
}

export function CancelOrderModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  totalAmount,
  currency,
  fulfillmentStatus,
  onSuccess,
}: CancelOrderModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const canCancel =
    fulfillmentStatus === "unfulfilled" || fulfillmentStatus === "partial";

  const handleSubmit = async () => {
    if (!canCancel) {
      toast.error(
        "This order cannot be cancelled. It has already been fulfilled."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await cancelOrderByCustomer(orderId, reason || undefined);

      if (result.success) {
        toast.success(
          result.refundMethod === "void"
            ? "Order cancelled successfully. Payment was voided (no fees charged)."
            : "Order cancelled successfully. Refund will be processed."
        );
        onOpenChange(false);
        onSuccess?.();
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

  if (!canCancel) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cancel Order #{orderNumber}</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this order? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Total:</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {fulfillmentStatus === "unfulfilled"
                ? "Payment will be voided (no fees charged) if not yet captured."
                : "Payment will be refunded if already captured."}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for cancellation (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Please let us know why you're cancelling this order..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Keep Order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
