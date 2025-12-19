"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { sendInvoiceForOrder } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  customerEmail: string | null;
  storeOwnerEmail: string | null;
  onSuccess: () => void;
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerEmail,
  storeOwnerEmail,
  onSuccess,
}: SendInvoiceDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fromEmail, setFromEmail] = useState(storeOwnerEmail || "");
  const [toEmail, setToEmail] = useState(customerEmail || "");
  const [customMessage, setCustomMessage] = useState("");
  const [lockPrices, setLockPrices] = useState(true);

  // Update emails when dialog opens
  useEffect(() => {
    if (open) {
      setFromEmail(storeOwnerEmail || "");
      setToEmail(customerEmail || "");
      setCustomMessage("");
      setLockPrices(true);
    }
  }, [open, storeOwnerEmail, customerEmail]);

  const handleSubmit = async () => {
    if (!fromEmail || !fromEmail.includes("@")) {
      toast.error("Please enter a valid 'From' email address");
      return;
    }

    if (!toEmail || !toEmail.includes("@")) {
      toast.error("Please enter a valid 'To' email address");
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvoiceForOrder({
        orderId,
        fromEmail,
        toEmail,
        customMessage: customMessage.trim() || null,
        lockPrices,
      });

      if (result.success) {
        toast.success(`Invoice sent successfully to ${toEmail}`);
        onOpenChange(false);
        onSuccess();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send invoice");
      }
    } catch (error) {
      toast.error("Failed to send invoice");
      console.error("Send invoice error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogDescription>
            Send invoice #{orderNumber} to the customer. The invoice will include a payment link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* From Email */}
          <div className="space-y-2">
            <Label htmlFor="from-email">From</Label>
            <Input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="store@example.com"
            />
          </div>

          {/* To Email */}
          <div className="space-y-2">
            <Label htmlFor="to-email">To</Label>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="custom-message">Custom Message (Optional)</Label>
            <Textarea
              id="custom-message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal message to the invoice email..."
              rows={3}
            />
          </div>

          {/* Lock Prices Toggle */}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="lock-prices" className="text-base cursor-pointer">
                Lock prices (recommended)
              </Label>
              <p className="text-sm text-muted-foreground">
                Prevent product prices, discounts, taxes, and shipping from changing after this invoice is sent.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Required for accounting and tax compliance.
              </p>
            </div>
            <Switch
              id="lock-prices"
              checked={lockPrices}
              onCheckedChange={setLockPrices}
            />
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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

