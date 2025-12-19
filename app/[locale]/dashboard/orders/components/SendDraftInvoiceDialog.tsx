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
import { sendInvoice } from "@/app/[locale]/actions/draft-orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";

interface SendDraftInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string | null;
  draftNumber: number | null;
  customerEmail: string | null;
  storeOwnerEmail: string | null;
  onSuccess?: () => void;
}

export function SendDraftInvoiceDialog({
  open,
  onOpenChange,
  draftId,
  draftNumber,
  customerEmail,
  storeOwnerEmail,
  onSuccess,
}: SendDraftInvoiceDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fromEmail, setFromEmail] = useState(storeOwnerEmail || "");
  const [toEmail, setToEmail] = useState(customerEmail || "");
  const [customMessage, setCustomMessage] = useState("");

  // Update emails when dialog opens
  useEffect(() => {
    if (open) {
      setFromEmail(storeOwnerEmail || "");
      setToEmail(customerEmail || "");
      setCustomMessage("");
    }
  }, [open, storeOwnerEmail, customerEmail]);

  const handleSubmit = async () => {
    if (!draftId) {
      toast.error("Draft order must be saved first");
      return;
    }

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
      const result = await sendInvoice(
        draftId,
        toEmail,
        fromEmail,
        customMessage.trim() || undefined
      );

      if (result.success) {
        toast.success(`Invoice sent successfully to ${toEmail}`);
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
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
            {draftNumber
              ? `Send invoice #${draftNumber} to the customer. The invoice will include a payment link.`
              : "Save the draft order first, then send the invoice."}
          </DialogDescription>
        </DialogHeader>

        {!draftId ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Please save the draft order before sending an invoice.
            </p>
          </div>
        ) : (
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
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          {draftId && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

