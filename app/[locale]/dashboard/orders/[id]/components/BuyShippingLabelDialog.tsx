"use client";

import React, { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import {
  getShippingRatesForLabel,
  purchaseShippingLabel,
  getShippingAddresses,
} from "@/app/[locale]/actions/shipping-labels";
import { getShippingPackages } from "@/app/[locale]/actions/shipping-packages";
import { CountrySelect } from "@/components/ui/country-select";
import { Separator } from "@/components/ui/separator";
import { kilogramsToOunces, centimetersToInches } from "@/lib/shipping-utils";
import toast from "react-hot-toast";

interface BuyShippingLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  storeId: string;
  onSuccess: () => void;
}

export function BuyShippingLabelDialog({
  open,
  onOpenChange,
  orderId,
  storeId,
  onSuccess,
}: BuyShippingLabelDialogProps) {
  const [step, setStep] = useState<"package" | "rates" | "confirm">("package");
  const [selectedPackage, setSelectedPackage] = useState<string>("__manual__");
  const [packages, setPackages] = useState<
    Array<{
      id: string;
      name: string;
      lengthIn: number;
      widthIn: number;
      heightIn: number;
      weightOz: number;
    }>
  >([]);
  const [customParcel, setCustomParcel] = useState({
    weightOz: "",
    lengthIn: "",
    widthIn: "",
    heightIn: "",
  });
  const [rates, setRates] = useState<
    Array<{
      id: string;
      carrier: string;
      service: string;
      rate: string;
      currency: string;
      estimatedDays?: number;
    }>
  >([]);
  const [selectedRate, setSelectedRate] = useState("");
  const [selectedRateInfo, setSelectedRateInfo] = useState<{
    carrier: string;
    service: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">(
    "imperial"
  );

  // Address state
  const [fromAddress, setFromAddress] = useState({
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    phone: "",
  });
  const [toAddress, setToAddress] = useState({
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    phone: "",
  });

  // Load packages and addresses on mount
  useEffect(() => {
    if (open && step === "package") {
      loadPackages();
      loadAddresses();
    }
  }, [open, step]);

  const loadPackages = async () => {
    try {
      const result = await getShippingPackages();
      if (result.success && result.data) {
        setPackages(result.data);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
    }
  };

  const loadAddresses = async () => {
    try {
      const result = await getShippingAddresses({ orderId, storeId });
      if (result.success && result.fromAddress && result.toAddress) {
        setFromAddress({
          street1: result.fromAddress.street1 || "",
          street2: result.fromAddress.street2 || "",
          city: result.fromAddress.city || "",
          state: result.fromAddress.state || "",
          zip: result.fromAddress.zip || "",
          country: result.fromAddress.country || "",
          phone: result.fromAddress.phone || "",
        });
        setToAddress({
          street1: result.toAddress.street1 || "",
          street2: result.toAddress.street2 || "",
          city: result.toAddress.city || "",
          state: result.toAddress.state || "",
          zip: result.toAddress.zip || "",
          country: result.toAddress.country || "",
          phone: result.toAddress.phone || "",
        });
      }
    } catch (error) {
      console.error("Error loading addresses:", error);
    }
  };

  // Validate parcel dimensions
  const validateParcel = () => {
    const warnings: string[] = [];
    const MAX_WEIGHT_OZ = 1120;
    const MAX_DIMENSION_IN = 108;

    // Convert to imperial for validation if needed
    let weight: number;
    let length: number;
    let width: number;
    let height: number;

    if (unitSystem === "metric") {
      weight = kilogramsToOunces(parseFloat(customParcel.weightOz));
      length = centimetersToInches(parseFloat(customParcel.lengthIn));
      width = centimetersToInches(parseFloat(customParcel.widthIn));
      height = centimetersToInches(parseFloat(customParcel.heightIn));
    } else {
      weight = parseFloat(customParcel.weightOz);
      length = parseFloat(customParcel.lengthIn);
      width = parseFloat(customParcel.widthIn);
      height = parseFloat(customParcel.heightIn);
    }

    if (isNaN(weight) || weight <= 0) {
      setError("Weight must be greater than 0");
      return false;
    }
    if (isNaN(length) || length <= 0) {
      setError("Length must be greater than 0");
      return false;
    }
    if (isNaN(width) || width <= 0) {
      setError("Width must be greater than 0");
      return false;
    }
    if (isNaN(height) || height <= 0) {
      setError("Height must be greater than 0");
      return false;
    }

    if (weight > MAX_WEIGHT_OZ) {
      warnings.push(
        `Weight (${(weight / 16).toFixed(1)} lbs) exceeds recommended maximum of ${(MAX_WEIGHT_OZ / 16).toFixed(1)} lbs`
      );
    }

    if (
      length > MAX_DIMENSION_IN ||
      width > MAX_DIMENSION_IN ||
      height > MAX_DIMENSION_IN
    ) {
      warnings.push(
        `One or more dimensions exceed recommended maximum of ${MAX_DIMENSION_IN} inches`
      );
    }

    setWarnings(warnings);
    setError("");
    return true;
  };

  const handleGetRates = async () => {
    if (!validateParcel()) {
      return;
    }

    setLoading(true);
    setError("");

    // Get parcel dimensions and convert to imperial if needed
    let parcelWeightOz: number;
    let parcelLengthIn: number;
    let parcelWidthIn: number;
    let parcelHeightIn: number;

    if (selectedPackage && selectedPackage !== "__manual__") {
      const pkg = packages.find((p) => p.id === selectedPackage);
      if (!pkg) {
        setError("Please select a package or enter dimensions");
        setLoading(false);
        return;
      }
      parcelWeightOz = pkg.weightOz;
      parcelLengthIn = pkg.lengthIn;
      parcelWidthIn = pkg.widthIn;
      parcelHeightIn = pkg.heightIn;
    } else {
      // Convert from metric to imperial if needed
      if (unitSystem === "metric") {
        parcelWeightOz = kilogramsToOunces(parseFloat(customParcel.weightOz));
        parcelLengthIn = centimetersToInches(parseFloat(customParcel.lengthIn));
        parcelWidthIn = centimetersToInches(parseFloat(customParcel.widthIn));
        parcelHeightIn = centimetersToInches(parseFloat(customParcel.heightIn));
      } else {
        parcelWeightOz = parseFloat(customParcel.weightOz);
        parcelLengthIn = parseFloat(customParcel.lengthIn);
        parcelWidthIn = parseFloat(customParcel.widthIn);
        parcelHeightIn = parseFloat(customParcel.heightIn);
      }
    }

    const parcel = {
      weightOz: parcelWeightOz,
      lengthIn: parcelLengthIn,
      widthIn: parcelWidthIn,
      heightIn: parcelHeightIn,
    };

    // Validate addresses
    if (
      !fromAddress.street1 ||
      !fromAddress.city ||
      !fromAddress.zip ||
      !fromAddress.country
    ) {
      setError("Please fill in all required from address fields");
      setLoading(false);
      return;
    }
    if (
      !toAddress.street1 ||
      !toAddress.city ||
      !toAddress.zip ||
      !toAddress.country
    ) {
      setError("Please fill in all required to address fields");
      setLoading(false);
      return;
    }

    const result = await getShippingRatesForLabel({
      orderId,
      storeId,
      parcel,
      fromAddress: {
        street1: fromAddress.street1,
        street2: fromAddress.street2 || undefined,
        city: fromAddress.city,
        state: fromAddress.state || undefined,
        zip: fromAddress.zip,
        country: fromAddress.country,
        phone: fromAddress.phone || undefined,
      },
      toAddress: {
        street1: toAddress.street1,
        street2: toAddress.street2 || undefined,
        city: toAddress.city,
        state: toAddress.state || undefined,
        zip: toAddress.zip,
        country: toAddress.country,
        phone: toAddress.phone || undefined,
      },
    });

    if (!result.success) {
      setError(result.error || "Failed to get shipping rates");
      setLoading(false);
      return;
    }

    if (!result.supported) {
      setError(
        result.error ||
          "Shipping labels not available for this route. Please use manual shipping."
      );
      setLoading(false);
      return;
    }

    setRates(result.rates || []);
    setStep("rates");
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!selectedRate) {
      setError("Please select a shipping service");
      return;
    }

    setLoading(true);
    setError("");

    // Get parcel dimensions and convert to imperial if needed
    let parcelWeightOz: number;
    let parcelLengthIn: number;
    let parcelWidthIn: number;
    let parcelHeightIn: number;

    if (selectedPackage && selectedPackage !== "__manual__") {
      const pkg = packages.find((p) => p.id === selectedPackage);
      if (!pkg) {
        setError("Package information is missing");
        setLoading(false);
        return;
      }
      parcelWeightOz = pkg.weightOz;
      parcelLengthIn = pkg.lengthIn;
      parcelWidthIn = pkg.widthIn;
      parcelHeightIn = pkg.heightIn;
    } else {
      // Convert from metric to imperial if needed
      if (unitSystem === "metric") {
        parcelWeightOz = kilogramsToOunces(parseFloat(customParcel.weightOz));
        parcelLengthIn = centimetersToInches(parseFloat(customParcel.lengthIn));
        parcelWidthIn = centimetersToInches(parseFloat(customParcel.widthIn));
        parcelHeightIn = centimetersToInches(parseFloat(customParcel.heightIn));
      } else {
        parcelWeightOz = parseFloat(customParcel.weightOz);
        parcelLengthIn = parseFloat(customParcel.lengthIn);
        parcelWidthIn = parseFloat(customParcel.widthIn);
        parcelHeightIn = parseFloat(customParcel.heightIn);
      }
    }

    const parcel = {
      weightOz: parcelWeightOz,
      lengthIn: parcelLengthIn,
      widthIn: parcelWidthIn,
      heightIn: parcelHeightIn,
    };

    // Validate addresses
    if (
      !fromAddress.street1 ||
      !fromAddress.city ||
      !fromAddress.zip ||
      !fromAddress.country
    ) {
      setError("Please fill in all required from address fields");
      setLoading(false);
      return;
    }
    if (
      !toAddress.street1 ||
      !toAddress.city ||
      !toAddress.zip ||
      !toAddress.country
    ) {
      setError("Please fill in all required to address fields");
      setLoading(false);
      return;
    }

    if (!selectedRateInfo) {
      setError("Please select a shipping service");
      setLoading(false);
      return;
    }

    const result = await purchaseShippingLabel({
      orderId,
      storeId,
      rateId: selectedRate, // Keep for backward compatibility, but we'll match by carrier/service
      carrier: selectedRateInfo.carrier,
      service: selectedRateInfo.service,
      parcel: {
        weightOz: parcel.weightOz,
        lengthIn: parcel.lengthIn,
        widthIn: parcel.widthIn,
        heightIn: parcel.heightIn,
      },
      fromAddress: {
        street1: fromAddress.street1,
        street2: fromAddress.street2 || undefined,
        city: fromAddress.city,
        state: fromAddress.state || undefined,
        zip: fromAddress.zip,
        country: fromAddress.country,
        phone: fromAddress.phone || undefined,
      },
      toAddress: {
        street1: toAddress.street1,
        street2: toAddress.street2 || undefined,
        city: toAddress.city,
        state: toAddress.state || undefined,
        zip: toAddress.zip,
        country: toAddress.country,
        phone: toAddress.phone || undefined,
      },
      labelFormat: "PDF",
    });

    if (result.success) {
      toast.success("Shipping label purchased successfully");
      onSuccess();
      onOpenChange(false);
      // Reset state
      setStep("package");
      setSelectedPackage("__manual__");
      setCustomParcel({
        weightOz: "",
        lengthIn: "",
        widthIn: "",
        heightIn: "",
      });
      setSelectedRate("");
      setSelectedRateInfo(null);
      setRates([]);
      setWarnings([]);
    } else {
      setError(result.error || "Failed to purchase shipping label");
    }

    setLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow dialog to close
    setTimeout(() => {
      setStep("package");
      setSelectedPackage("__manual__");
      setCustomParcel({
        weightOz: "",
        lengthIn: "",
        widthIn: "",
        heightIn: "",
      });
      setSelectedRate("");
      setSelectedRateInfo(null);
      setRates([]);
      setError("");
      setWarnings([]);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buy Shipping Label</DialogTitle>
          <DialogDescription>
            Purchase a shipping label via EasyPost (international shipping only)
          </DialogDescription>
        </DialogHeader>

        {step === "package" && (
          <div className="space-y-6">
            {/* From Address Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  From Address (Origin)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Your store&apos;s shipping origin address
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="fromStreet1">Street Address *</Label>
                  <Input
                    id="fromStreet1"
                    value={fromAddress.street1}
                    onChange={(e) =>
                      setFromAddress({
                        ...fromAddress,
                        street1: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fromStreet2">
                    Street Address 2 (Optional)
                  </Label>
                  <Input
                    id="fromStreet2"
                    value={fromAddress.street2}
                    onChange={(e) =>
                      setFromAddress({
                        ...fromAddress,
                        street2: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromCity">City *</Label>
                    <Input
                      id="fromCity"
                      value={fromAddress.city}
                      onChange={(e) =>
                        setFromAddress({ ...fromAddress, city: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fromState">State/Province</Label>
                    <Input
                      id="fromState"
                      value={fromAddress.state}
                      onChange={(e) =>
                        setFromAddress({
                          ...fromAddress,
                          state: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromZip">ZIP/Postal Code *</Label>
                    <Input
                      id="fromZip"
                      value={fromAddress.zip}
                      onChange={(e) =>
                        setFromAddress({ ...fromAddress, zip: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fromCountry">Country *</Label>
                    <CountrySelect
                      value={fromAddress.country}
                      onValueChange={(value) =>
                        setFromAddress({ ...fromAddress, country: value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fromPhone">Phone Number</Label>
                  <Input
                    id="fromPhone"
                    type="tel"
                    value={fromAddress.phone}
                    onChange={(e) =>
                      setFromAddress({ ...fromAddress, phone: e.target.value })
                    }
                    placeholder="+1 555-123-4567"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required by some carriers (e.g., FedEx)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* To Address Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  To Address (Destination)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Customer&apos;s shipping address
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="toStreet1">Street Address *</Label>
                  <Input
                    id="toStreet1"
                    value={toAddress.street1}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, street1: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="toStreet2">Street Address 2 (Optional)</Label>
                  <Input
                    id="toStreet2"
                    value={toAddress.street2}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, street2: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="toCity">City *</Label>
                    <Input
                      id="toCity"
                      value={toAddress.city}
                      onChange={(e) =>
                        setToAddress({ ...toAddress, city: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="toState">State/Province</Label>
                    <Input
                      id="toState"
                      value={toAddress.state}
                      onChange={(e) =>
                        setToAddress({ ...toAddress, state: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="toZip">ZIP/Postal Code *</Label>
                    <Input
                      id="toZip"
                      value={toAddress.zip}
                      onChange={(e) =>
                        setToAddress({ ...toAddress, zip: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="toCountry">Country *</Label>
                    <CountrySelect
                      value={toAddress.country}
                      onValueChange={(value) =>
                        setToAddress({ ...toAddress, country: value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="toPhone">Phone Number</Label>
                  <Input
                    id="toPhone"
                    type="tel"
                    value={toAddress.phone}
                    onChange={(e) =>
                      setToAddress({ ...toAddress, phone: e.target.value })
                    }
                    placeholder="+1 555-123-4567"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required by some carriers (e.g., FedEx)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Package Selection */}
            <div className="space-y-4">
              <div>
                <Label>Select Package (Optional)</Label>
                <Select
                  value={selectedPackage || "__manual__"}
                  onValueChange={(value) => {
                    setSelectedPackage(value);
                    if (value && value !== "__manual__") {
                      const pkg = packages.find((p) => p.id === value);
                      if (pkg) {
                        // Convert package dimensions to selected unit system for display
                        if (unitSystem === "metric") {
                          setCustomParcel({
                            weightOz: (pkg.weightOz / 35.274).toFixed(2), // oz to kg
                            lengthIn: (pkg.lengthIn / 0.393701).toFixed(1), // in to cm
                            widthIn: (pkg.widthIn / 0.393701).toFixed(1),
                            heightIn: (pkg.heightIn / 0.393701).toFixed(1),
                          });
                        } else {
                          setCustomParcel({
                            weightOz: pkg.weightOz.toString(),
                            lengthIn: pkg.lengthIn.toString(),
                            widthIn: pkg.widthIn.toString(),
                            heightIn: pkg.heightIn.toString(),
                          });
                        }
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package or enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Enter manually</SelectItem>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.lengthIn}&quot; × {pkg.widthIn}&quot; ×{" "}
                        {pkg.heightIn}&quot;, {pkg.weightOz} oz)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit System Selector */}
              <div>
                <Label>Unit System</Label>
                <Select
                  value={unitSystem}
                  onValueChange={(value: "imperial" | "metric") => {
                    // Clear values when switching unit systems
                    setCustomParcel({
                      weightOz: "",
                      lengthIn: "",
                      widthIn: "",
                      heightIn: "",
                    });
                    setUnitSystem(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial">
                      Imperial (inches, oz)
                    </SelectItem>
                    <SelectItem value="metric">Metric (cm, kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight">
                    Weight {unitSystem === "metric" ? "(kg)" : "(oz)"} *
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    step={unitSystem === "metric" ? "0.01" : "0.1"}
                    value={customParcel.weightOz}
                    onChange={(e) =>
                      setCustomParcel({
                        ...customParcel,
                        weightOz: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="length">
                    Length {unitSystem === "metric" ? "(cm)" : "(inches)"} *
                  </Label>
                  <Input
                    id="length"
                    type="number"
                    step={unitSystem === "metric" ? "0.1" : "0.1"}
                    value={customParcel.lengthIn}
                    onChange={(e) =>
                      setCustomParcel({
                        ...customParcel,
                        lengthIn: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="width">
                    Width {unitSystem === "metric" ? "(cm)" : "(inches)"} *
                  </Label>
                  <Input
                    id="width"
                    type="number"
                    step={unitSystem === "metric" ? "0.1" : "0.1"}
                    value={customParcel.widthIn}
                    onChange={(e) =>
                      setCustomParcel({
                        ...customParcel,
                        widthIn: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="height">
                    Height {unitSystem === "metric" ? "(cm)" : "(inches)"} *
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    step={unitSystem === "metric" ? "0.1" : "0.1"}
                    value={customParcel.heightIn}
                    onChange={(e) =>
                      setCustomParcel({
                        ...customParcel,
                        heightIn: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {warnings.length > 0 && (
              <Alert variant="default" className="border-yellow-500">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleGetRates}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Rates...
                </>
              ) : (
                "Get Shipping Rates"
              )}
            </Button>
          </div>
        )}

        {step === "rates" && (
          <div className="space-y-4">
            <div>
              <Label>Select Shipping Service</Label>
              <RadioGroup
                value={selectedRate}
                onValueChange={(value) => {
                  setSelectedRate(value);
                  const rate = rates.find((r) => r.id === value);
                  if (rate) {
                    setSelectedRateInfo({
                      carrier: rate.carrier,
                      service: rate.service,
                    });
                  }
                }}
              >
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg"
                    >
                      <RadioGroupItem value={rate.id} id={rate.id} />
                      <Label
                        htmlFor={rate.id}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">
                              {rate.carrier} {rate.service}
                            </span>
                            {rate.estimatedDays && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({rate.estimatedDays} days)
                              </span>
                            )}
                          </div>
                          <div className="font-medium">
                            {rate.currency} {rate.rate}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Shipping cost will be deducted from your balance.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("package")}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={!selectedRate || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purchasing...
                  </>
                ) : (
                  "Buy Label & Mark as Shipped"
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
