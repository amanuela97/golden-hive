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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { markOrderShippedManually } from "@/app/[locale]/actions/shipping-labels";
import toast from "react-hot-toast";

interface ManualShippingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  storeId: string;
  onSuccess: () => void;
}

const shippingCarriers = [
  "USPS",
  "UPS",
  "FedEx",
  "DHL",
  "Canada Post",
  "Royal Mail",
  "Posti",
  "Other",
];

// Tracking number validation patterns
const trackingPatterns: Record<string, RegExp> = {
  usps: /^[0-9]{20,22}$|^[A-Z]{2}[0-9]{9}[A-Z]{2}$/,
  ups: /^1Z[0-9A-Z]{16}$/,
  fedex: /^[0-9]{12,14}$/,
  dhl: /^[0-9]{10,11}$/,
  "canada post": /^[0-9A-Z]{13,16}$/,
  "royal mail": /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/,
  posti: /^[0-9A-Z]{10,20}$/,
  other: /^.{5,}$/, // Generic: at least 5 characters
};

export function ManualShippingDialog({
  open,
  onOpenChange,
  orderId,
  storeId,
  onSuccess,
}: ManualShippingDialogProps) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [error, setError] = useState("");
  const [isValidTracking, setIsValidTracking] = useState(true);
  const [loading, setLoading] = useState(false);

  // Validate tracking number format
  const validateTrackingNumber = (value: string) => {
    if (!value || value.trim().length < 5) {
      setIsValidTracking(false);
      return false;
    }

    if (!carrier) {
      // If no carrier selected, just check minimum length
      setIsValidTracking(value.trim().length >= 5);
      return value.trim().length >= 5;
    }

    const carrierLower = carrier.toLowerCase();
    const pattern = trackingPatterns[carrierLower] || trackingPatterns.other;

    const isValid = pattern.test(value.trim());
    setIsValidTracking(isValid);
    return isValid;
  };

  const handleCarrierChange = (value: string) => {
    setCarrier(value);
    if (trackingNumber) {
      validateTrackingNumber(trackingNumber);
    }
  };

  const handleTrackingChange = (value: string) => {
    setTrackingNumber(value);
    validateTrackingNumber(value);
  };

  const handleSubmit = async () => {
    setError("");

    if (!carrier) {
      setError("Please select a carrier");
      return;
    }

    if (!trackingNumber.trim()) {
      setError("Please enter a tracking number");
      return;
    }

    if (!validateTrackingNumber(trackingNumber)) {
      setError("Please enter a valid tracking number format");
      return;
    }

    setLoading(true);

    const result = await markOrderShippedManually({
      orderId,
      storeId,
      carrier,
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim() || undefined,
    });

    if (result.success) {
      toast.success("Order marked as shipped");
      onSuccess();
      onOpenChange(false);
      // Reset state
      setCarrier("");
      setTrackingNumber("");
      setTrackingUrl("");
      setError("");
      setIsValidTracking(true);
    } else {
      setError(result.error || "Failed to mark order as shipped");
    }

    setLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay
    setTimeout(() => {
      setCarrier("");
      setTrackingNumber("");
      setTrackingUrl("");
      setError("");
      setIsValidTracking(true);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark as Shipped Manually</DialogTitle>
          <DialogDescription>
            Enter tracking information for this shipment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="carrier">Carrier *</Label>
            <Select value={carrier} onValueChange={handleCarrierChange}>
              <SelectTrigger id="carrier">
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {shippingCarriers.map((carrierOption) => (
                  <SelectItem key={carrierOption} value={carrierOption}>
                    {carrierOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tracking">Tracking Number *</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => handleTrackingChange(e.target.value)}
              placeholder="Enter tracking number"
              required
            />
            {!isValidTracking && trackingNumber && (
              <p className="text-sm text-red-500 mt-1">
                Please enter a valid tracking number format for{" "}
                {carrier || "the selected carrier"}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="trackingUrl">Tracking URL (Optional)</Label>
            <Input
              id="trackingUrl"
              type="url"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!carrier || !isValidTracking || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Mark as Shipped"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
