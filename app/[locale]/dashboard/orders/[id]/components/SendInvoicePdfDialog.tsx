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
import { sendInvoicePdfForOrder } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";

interface SendInvoicePdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  invoiceNumber: string | null;
  customerEmail: string | null;
  storeOwnerEmail: string | null;
  onSuccess: () => void;
}

export function SendInvoicePdfDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  invoiceNumber,
  customerEmail,
  storeOwnerEmail,
  onSuccess,
}: SendInvoicePdfDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // Update emails when dialog opens or when storeOwnerEmail/customerEmail changes
  useEffect(() => {
    if (open) {
      // Always update fromEmail if storeOwnerEmail is available
      if (storeOwnerEmail) {
        setFromEmail(storeOwnerEmail);
      }
      // Always update toEmail if customerEmail is available
      if (customerEmail) {
        setToEmail(customerEmail);
      }
      // Reset custom message when dialog opens
      setCustomMessage("");
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
      const result = await sendInvoicePdfForOrder({
        orderId,
        fromEmail,
        toEmail,
        customMessage: customMessage.trim() || null,
        lockPrices: false,
      });

      if (result.success) {
        toast.success(`Invoice PDF sent successfully to ${toEmail}`);
        onOpenChange(false);
        onSuccess();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send invoice PDF");
      }
    } catch (error) {
      toast.error("Failed to send invoice PDF");
      console.error("Send invoice PDF error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Invoice PDF</DialogTitle>
          <DialogDescription>
            Send the invoice PDF for Order #{orderNumber}
            {invoiceNumber && ` (Invoice ${invoiceNumber})`} to the customer.
            The PDF will be attached to the email.
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
              placeholder="Add a personal message to the email..."
              rows={3}
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
              "Send Invoice PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
