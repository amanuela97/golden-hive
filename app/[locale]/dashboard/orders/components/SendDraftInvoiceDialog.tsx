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
  onLoadingChange?: (loading: boolean) => void;
}

export function SendDraftInvoiceDialog({
  open,
  onOpenChange,
  draftId,
  draftNumber,
  customerEmail,
  storeOwnerEmail,
  onSuccess,
  onLoadingChange,
}: SendDraftInvoiceDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [userEditedFromEmail, setUserEditedFromEmail] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log("SendDraftInvoiceDialog - storeOwnerEmail prop:", storeOwnerEmail);
    console.log("SendDraftInvoiceDialog - fromEmail state:", fromEmail);
  }, [storeOwnerEmail, fromEmail]);

  // Update emails when dialog opens or when storeOwnerEmail/customerEmail changes
  useEffect(() => {
    if (open) {
      // Always update fromEmail if storeOwnerEmail is available and user hasn't edited it
      if (storeOwnerEmail && !userEditedFromEmail) {
        setFromEmail(storeOwnerEmail);
      }
      // Always update toEmail if customerEmail is available
      if (customerEmail) {
        setToEmail(customerEmail);
      }
      // Reset custom message when dialog opens
      setCustomMessage("");
      // Reset user edited flag when dialog opens
      setUserEditedFromEmail(false);
    }
  }, [open, storeOwnerEmail, customerEmail, userEditedFromEmail]);

  // Also update fromEmail when storeOwnerEmail changes (even if dialog is already open)
  // This handles the case where storeOwnerEmail arrives after the dialog opens
  // But only if user hasn't manually edited it
  useEffect(() => {
    if (storeOwnerEmail && !userEditedFromEmail) {
      setFromEmail(storeOwnerEmail);
    }
  }, [storeOwnerEmail, userEditedFromEmail]);

  // Update toEmail when customerEmail changes
  useEffect(() => {
    if (customerEmail) {
      setToEmail(customerEmail);
    }
  }, [customerEmail]);

  const handleSubmit = async () => {
    if (!draftId) {
      toast.error("Draft order must be saved first");
      return;
    }

    // Use storeOwnerEmail if available and user hasn't edited, otherwise use fromEmail
    const emailToUse = userEditedFromEmail ? fromEmail : (storeOwnerEmail || fromEmail);
    
    if (!emailToUse || !emailToUse.includes("@")) {
      toast.error("Please enter a valid 'From' email address");
      return;
    }

    if (!toEmail || !toEmail.includes("@")) {
      toast.error("Please enter a valid 'To' email address");
      return;
    }

    setLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }
    try {
      // Use storeOwnerEmail if available and user hasn't edited, otherwise use fromEmail
      const emailToUse = userEditedFromEmail ? fromEmail : (storeOwnerEmail || fromEmail);
      
      console.log("Sending invoice with:", { draftId, toEmail, fromEmail: emailToUse });
      
      const result = await sendInvoice(
        draftId,
        toEmail,
        emailToUse,
        customMessage.trim() || undefined
      );

      console.log("Invoice send result:", result);

      // Check if result is valid
      if (!result) {
        console.error("No result returned from sendInvoice");
        toast.error("Failed to send invoice: No response from server");
        return;
      }

      if (result.success) {
        toast.success(`Invoice sent successfully to ${toEmail}`);
        // Close dialog first
        onOpenChange(false);
        // Call onSuccess callback (if provided)
        if (onSuccess) {
          try {
            onSuccess();
          } catch (error) {
            console.error("Error in onSuccess callback:", error);
          }
        }
        // Always redirect to draft_orders page after successful send
        setTimeout(() => {
          router.push("/dashboard/draft_orders");
        }, 200);
      } else {
        const errorMessage = result.error || "Failed to send invoice";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Send invoice error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      
      // Check if it's a Next.js server action error
      if (errorMessage.includes("unexpected response") || errorMessage.includes("Failed to fetch")) {
        toast.error("Failed to send invoice: Server communication error. Please try again.");
      } else {
        toast.error(`Failed to send invoice: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogDescription>
            {draftId && draftNumber
              ? `Send invoice #${draftNumber} to the customer. The invoice will include a payment link.`
              : draftId
              ? "Send invoice to the customer. The invoice will include a payment link."
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
                value={userEditedFromEmail ? fromEmail : (storeOwnerEmail || fromEmail)}
                onChange={(e) => {
                  setFromEmail(e.target.value);
                  setUserEditedFromEmail(true);
                }}
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

