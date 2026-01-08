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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestRefund } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";

interface RefundRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  onSuccess?: () => void;
}

const refundReasons = [
  { value: "defective", label: "Defective or damaged item" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "not_as_described", label: "Item not as described" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "late_delivery", label: "Late delivery" },
  { value: "other", label: "Other" },
];

export function RefundRequestForm({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  totalAmount,
  currency,
  onSuccess,
}: RefundRequestFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason for the refund request");
      return;
    }

    setLoading(true);
    try {
      const result = await requestRefund(
        orderId,
        reason,
        description || undefined
      );

      if (result.success) {
        toast.success("Refund request submitted successfully. The seller will review it shortly.");
        onOpenChange(false);
        setReason("");
        setDescription("");
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to submit refund request");
      }
    } catch (error) {
      toast.error("Failed to submit refund request");
      console.error("Refund request error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Refund for Order #{orderNumber}</DialogTitle>
          <DialogDescription>
            Submit a refund request for this order. The seller will review your
            request and respond within 1-2 business days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Total:</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for refund *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {refundReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Please provide any additional information that might help..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !reason}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

