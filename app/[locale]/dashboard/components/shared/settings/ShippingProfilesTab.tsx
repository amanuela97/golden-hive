"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import {
  createShippingProfile,
  getShippingProfiles,
  updateShippingProfile,
  deleteShippingProfile,
  addShippingDestination,
  updateShippingDestination,
  getShippingDestinations,
  addShippingRate,
  deleteShippingRate,
  getShippingRatesForDestination,
  type ShippingProfileData,
  type ShippingDestinationData,
  type ShippingRateData,
} from "@/app/[locale]/actions/shipping-profiles";
import { CountrySelect } from "@/components/ui/country-select";
import { postcodeValidator } from "postcode-validator";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomPackagesTab from "./CustomPackagesTab";

interface ShippingProfile {
  id: string;
  name: string;
  pricingType: string;
  originCountry: string;
  originPostalCode: string | null;
  processingDaysMin: number;
  processingDaysMax: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ProcessingTimeOption =
  | "1"
  | "1-2"
  | "2-3"
  | "3-5"
  | "1-2weeks"
  | "2-3weeks"
  | "3-4weeks"
  | "custom";

type DestinationLocation = "domestic" | "everywhere_else" | "country";

interface DestinationRow {
  id: string; // Temporary ID for new rows
  location: DestinationLocation;
  countryCode?: string;
  freeShipping: boolean;
  firstItemPrice: string;
  additionalItemPrice: string;
  currency: string;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  existingDestinationId?: string; // If editing existing
  existingRateId?: string; // If editing existing rate
}

interface UpgradeRow {
  id: string; // Temporary ID
  name: string;
  price: string;
  currency: string;
  minDays: string;
  maxDays: string;
}

export default function ShippingProfilesTab() {
  const [profiles, setProfiles] = useState<ShippingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form mode: "list" | "create" | "edit"
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // Form state
  const [profileName, setProfileName] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [originPostalCode, setOriginPostalCode] = useState("");
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const [processingTimeOption, setProcessingTimeOption] =
    useState<ProcessingTimeOption>("1-2");
  const [processingDaysMin, setProcessingDaysMin] = useState(1);
  const [processingDaysMax, setProcessingDaysMax] = useState(2);
  const [isDefault, setIsDefault] = useState(false);

  // Destinations (repeatable rows)
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);

  // Upgrades (optional)
  const [upgrades, setUpgrades] = useState<UpgradeRow[]>([]);

  // Store currency (for price inputs)
  const [storeCurrency] = useState("EUR");

  const validatePostalCode = (postalCode: string, country: string): boolean => {
    if (!postalCode || !country) return true;
    try {
      return postcodeValidator(postalCode, country);
    } catch {
      return true;
    }
  };

  const getProcessingTimeFromOption = (
    option: ProcessingTimeOption
  ): { min: number; max: number } => {
    switch (option) {
      case "1":
        return { min: 1, max: 1 };
      case "1-2":
        return { min: 1, max: 2 };
      case "2-3":
        return { min: 2, max: 3 };
      case "3-5":
        return { min: 3, max: 5 };
      case "1-2weeks":
        return { min: 7, max: 14 };
      case "2-3weeks":
        return { min: 14, max: 21 };
      case "3-4weeks":
        return { min: 21, max: 28 };
      case "custom":
        return { min: processingDaysMin, max: processingDaysMax };
      default:
        return { min: 1, max: 2 };
    }
  };

  useEffect(() => {
    loadProfiles();
    // Get store currency (you may need to fetch this from store settings)
    // For now, defaulting to EUR
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const result = await getShippingProfiles();
      if (result.success && result.result) {
        setProfiles(result.result);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast.error("Failed to load shipping profiles");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProfileName("");
    setOriginCountry("");
    setOriginPostalCode("");
    setPostalCodeError(null);
    setProcessingTimeOption("1-2");
    setProcessingDaysMin(1);
    setProcessingDaysMax(2);
    setIsDefault(false);
    setDestinations([]);
    setUpgrades([]);
    setEditingProfileId(null);
  };

  const handleEditProfile = async (profile: ShippingProfile) => {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setOriginCountry(profile.originCountry);
    setOriginPostalCode(profile.originPostalCode || "");
    setProcessingDaysMin(profile.processingDaysMin);
    setProcessingDaysMax(profile.processingDaysMax);
    setIsDefault(profile.isDefault);

    // Determine processing time option
    let option: ProcessingTimeOption = "custom";
    if (profile.processingDaysMin === 1 && profile.processingDaysMax === 1) {
      option = "1";
    } else if (
      profile.processingDaysMin === 1 &&
      profile.processingDaysMax === 2
    ) {
      option = "1-2";
    } else if (
      profile.processingDaysMin === 2 &&
      profile.processingDaysMax === 3
    ) {
      option = "2-3";
    } else if (
      profile.processingDaysMin === 3 &&
      profile.processingDaysMax === 5
    ) {
      option = "3-5";
    } else if (
      profile.processingDaysMin === 7 &&
      profile.processingDaysMax === 14
    ) {
      option = "1-2weeks";
    } else if (
      profile.processingDaysMin === 14 &&
      profile.processingDaysMax === 21
    ) {
      option = "2-3weeks";
    } else if (
      profile.processingDaysMin === 21 &&
      profile.processingDaysMax === 28
    ) {
      option = "3-4weeks";
    }
    setProcessingTimeOption(option);

    // Load destinations and rates
    try {
      const destResult = await getShippingDestinations(profile.id);
      if (destResult.success && destResult.result) {
        const destinationRows: DestinationRow[] = [];
        for (const dest of destResult.result) {
          // Get rates for this destination
          const rateResult = await getShippingRatesForDestination(dest.id);
          if (
            rateResult.success &&
            rateResult.result &&
            rateResult.result.length > 0
          ) {
            // Use the first rate (primary rate)
            const rate = rateResult.result[0];
            // Determine location type: if country matches origin, it's domestic
            const isDomestic =
              dest.destinationType === "country" &&
              dest.countryCode === profile.originCountry;
            destinationRows.push({
              id: `dest-${dest.id}`,
              location: isDomestic
                ? "domestic"
                : dest.destinationType === "country"
                  ? "country"
                  : dest.destinationType === "everywhere_else"
                    ? "everywhere_else"
                    : "domestic",
              countryCode: dest.countryCode || undefined,
              freeShipping: rate.freeShipping,
              firstItemPrice: rate.firstItemPriceCents
                ? (rate.firstItemPriceCents / 100).toFixed(2)
                : "0",
              additionalItemPrice: rate.additionalItemPriceCents
                ? (rate.additionalItemPriceCents / 100).toFixed(2)
                : "0",
              currency: rate.currency,
              minDeliveryDays: rate.transitDaysMin?.toString() || "",
              maxDeliveryDays: rate.transitDaysMax?.toString() || "",
              existingDestinationId: dest.id,
              existingRateId: rate.id,
            });
          } else {
            // No rates, create empty row
            // Determine location type: if country matches origin, it's domestic
            const isDomestic =
              dest.destinationType === "country" &&
              dest.countryCode === profile.originCountry;
            destinationRows.push({
              id: `dest-${dest.id}`,
              location: isDomestic
                ? "domestic"
                : dest.destinationType === "country"
                  ? "country"
                  : dest.destinationType === "everywhere_else"
                    ? "everywhere_else"
                    : "domestic",
              countryCode: dest.countryCode || undefined,
              freeShipping: false,
              firstItemPrice: "0",
              additionalItemPrice: "0",
              currency: storeCurrency,
              minDeliveryDays: "",
              maxDeliveryDays: "",
              existingDestinationId: dest.id,
            });
          }
        }
        setDestinations(destinationRows);
      }
    } catch (error) {
      console.error("Error loading destinations:", error);
    }

    setMode("edit");
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this shipping profile?")) {
      return;
    }

    try {
      const result = await deleteShippingProfile(profileId);
      if (result.success) {
        toast.success("Shipping profile deleted");
        loadProfiles();
      } else {
        toast.error(result.error || "Failed to delete profile");
      }
    } catch (error) {
      console.error("Error deleting profile:", error);
      toast.error("Failed to delete profile");
    }
  };

  const addDestinationRow = () => {
    setDestinations([
      ...destinations,
      {
        id: `new-${Date.now()}`,
        location: "domestic",
        freeShipping: false,
        firstItemPrice: "0",
        additionalItemPrice: "0",
        currency: storeCurrency,
        minDeliveryDays: "",
        maxDeliveryDays: "",
      },
    ]);
  };

  const removeDestinationRow = (id: string) => {
    setDestinations(destinations.filter((d) => d.id !== id));
  };

  const updateDestinationRow = (
    id: string,
    updates: Partial<DestinationRow>
  ) => {
    setDestinations(
      destinations.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const addUpgradeRow = () => {
    setUpgrades([
      ...upgrades,
      {
        id: `upgrade-${Date.now()}`,
        name: "",
        price: "0",
        currency: storeCurrency,
        minDays: "",
        maxDays: "",
      },
    ]);
  };

  const removeUpgradeRow = (id: string) => {
    setUpgrades(upgrades.filter((u) => u.id !== id));
  };

  const updateUpgradeRow = (id: string, updates: Partial<UpgradeRow>) => {
    setUpgrades(upgrades.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Validation
      if (!profileName.trim()) {
        toast.error("Profile name is required");
        setIsSaving(false);
        return;
      }

      if (!originCountry) {
        toast.error("Origin country is required");
        setIsSaving(false);
        return;
      }

      if (
        originPostalCode &&
        !validatePostalCode(originPostalCode, originCountry)
      ) {
        toast.error("Invalid postal code for selected country");
        setIsSaving(false);
        return;
      }

      if (destinations.length === 0) {
        toast.error("At least one destination is required");
        setIsSaving(false);
        return;
      }

      // Validate destinations
      for (const dest of destinations) {
        if (dest.location === "country" && !dest.countryCode) {
          toast.error("Please select a country for all destination rows");
          setIsSaving(false);
          return;
        }

        if (!dest.freeShipping) {
          const firstPrice = parseFloat(dest.firstItemPrice);
          if (isNaN(firstPrice) || firstPrice < 0) {
            toast.error("First item price must be a valid number ≥ 0");
            setIsSaving(false);
            return;
          }
        }

        const additionalPrice = parseFloat(dest.additionalItemPrice);
        if (isNaN(additionalPrice) || additionalPrice < 0) {
          toast.error("Additional item price must be a valid number ≥ 0");
          setIsSaving(false);
          return;
        }

        if (dest.minDeliveryDays && dest.maxDeliveryDays) {
          const min = parseInt(dest.minDeliveryDays);
          const max = parseInt(dest.maxDeliveryDays);
          if (isNaN(min) || isNaN(max) || min > max) {
            toast.error("Delivery days: min must be ≤ max");
            setIsSaving(false);
            return;
          }
        }
      }

      // Get processing time
      const processingTime =
        processingTimeOption === "custom"
          ? { min: processingDaysMin, max: processingDaysMax }
          : getProcessingTimeFromOption(processingTimeOption);

      // Create or update profile
      const profileData: ShippingProfileData = {
        name: profileName.trim(),
        pricingType: "manual",
        originCountry,
        originPostalCode: originPostalCode || undefined,
        processingDaysMin: processingTime.min,
        processingDaysMax: processingTime.max,
        isDefault,
      };

      let profileId: string;
      if (editingProfileId) {
        const result = await updateShippingProfile(
          editingProfileId,
          profileData
        );
        if (!result.success) {
          toast.error(result.error || "Failed to update profile");
          setIsSaving(false);
          return;
        }
        profileId = editingProfileId;
      } else {
        const result = await createShippingProfile(profileData);
        if (!result.success || !result.result) {
          toast.error(result.error || "Failed to create profile");
          setIsSaving(false);
          return;
        }
        profileId = result.result.id;
      }

      // Handle destinations and rates
      for (const dest of destinations) {
        let destinationId: string;

        if (dest.existingDestinationId) {
          // Update existing destination if country code or location type changed
          const destData: ShippingDestinationData = {
            destinationType:
              dest.location === "country"
                ? "country"
                : dest.location === "everywhere_else"
                  ? "everywhere_else"
                  : "country", // "domestic" maps to "country" with origin country
            countryCode:
              dest.location === "country"
                ? dest.countryCode
                : dest.location === "domestic"
                  ? originCountry // Use origin country for domestic
                  : undefined,
            excluded: false,
          };

          const updateResult = await updateShippingDestination(
            dest.existingDestinationId,
            destData
          );
          if (!updateResult.success) {
            console.error("Failed to update destination:", updateResult.error);
            continue;
          }
          destinationId = dest.existingDestinationId;
        } else {
          // Create new destination
          // Map "domestic" to "country" with origin country
          const destData: ShippingDestinationData = {
            destinationType:
              dest.location === "country"
                ? "country"
                : dest.location === "everywhere_else"
                  ? "everywhere_else"
                  : "country", // "domestic" maps to "country" with origin country
            countryCode:
              dest.location === "country"
                ? dest.countryCode
                : dest.location === "domestic"
                  ? originCountry // Use origin country for domestic
                  : undefined,
            excluded: false,
          };

          const destResult = await addShippingDestination(profileId, destData);
          if (!destResult.success || !destResult.result) {
            console.error("Failed to create destination:", destResult.error);
            continue;
          }
          destinationId = destResult.result.id;
        }

        // Create or update rate
        const rateData: ShippingRateData = {
          serviceName: "Standard",
          freeShipping: dest.freeShipping,
          firstItemPriceCents: dest.freeShipping
            ? undefined
            : Math.round(parseFloat(dest.firstItemPrice) * 100),
          additionalItemPriceCents: Math.round(
            parseFloat(dest.additionalItemPrice) * 100
          ),
          currency: dest.currency,
          transitDaysMin: dest.minDeliveryDays
            ? parseInt(dest.minDeliveryDays)
            : undefined,
          transitDaysMax: dest.maxDeliveryDays
            ? parseInt(dest.maxDeliveryDays)
            : undefined,
          sortOrder: 0,
        };

        if (dest.existingRateId) {
          // For now, we'll delete and recreate (update not implemented yet)
          await deleteShippingRate(dest.existingRateId);
        }

        await addShippingRate(destinationId, rateData);
      }

      // Handle upgrades (optional - for future implementation)
      // Upgrades would be stored as additional rates with different service names

      toast.success(
        editingProfileId
          ? "Shipping profile updated"
          : "Shipping profile created"
      );
      resetForm();
      setMode("list");
      loadProfiles();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="text-center">Loading shipping profiles...</div>
      </Card>
    );
  }

  if (mode === "create" || mode === "edit") {
    return (
      <Tabs defaultValue="profiles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profiles">Shipping Profiles</TabsTrigger>
          <TabsTrigger value="packages">Custom Packages</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-6">
          <Card className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {mode === "edit" ? "Edit" : "Create"} Shipping Profile
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure shipping rates and delivery times
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setMode("list");
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Profile Name */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold">Shipping Profile Name</h4>
              <div className="space-y-2">
                <Label htmlFor="profileName">Shipping profile name</Label>
                <Input
                  id="profileName"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Standard shipping"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Internal name (not shown to buyers)
                </p>
              </div>
            </div>

            <Separator />

            {/* Section 2: Shipping Origin */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold">
                Shipping Origin (Where You&apos;ll Ship From)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="originCountry">Country</Label>
                  <CountrySelect
                    value={originCountry}
                    onValueChange={(value) => {
                      setOriginCountry(value);
                      setOriginPostalCode(""); // Reset postal code
                      setPostalCodeError(null);
                    }}
                    placeholder="Select country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="originPostalCode">
                    {originCountry === "US" ? "ZIP code" : "Postal code"}
                  </Label>
                  <Input
                    id="originPostalCode"
                    value={originPostalCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOriginPostalCode(value);
                      if (value && originCountry) {
                        const isValid = validatePostalCode(
                          value,
                          originCountry
                        );
                        setPostalCodeError(
                          isValid ? null : "Invalid postal code format"
                        );
                      } else {
                        setPostalCodeError(null);
                      }
                    }}
                    placeholder={
                      originCountry === "US"
                        ? "12345"
                        : originCountry === "FI"
                          ? "00100"
                          : "Postal code"
                    }
                    maxLength={12}
                    required
                  />
                  {postalCodeError && (
                    <p className="text-sm text-destructive">
                      {postalCodeError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3: Processing Time */}
            <div className="space-y-4">
              <h4 className="text-base font-semibold">Processing Time</h4>
              <div className="space-y-2">
                <Label htmlFor="processingTime">Processing time</Label>
                <Select
                  value={processingTimeOption}
                  onValueChange={(value: ProcessingTimeOption) => {
                    setProcessingTimeOption(value);
                    if (value !== "custom") {
                      const time = getProcessingTimeFromOption(value);
                      setProcessingDaysMin(time.min);
                      setProcessingDaysMax(time.max);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 business day</SelectItem>
                    <SelectItem value="1-2">1–2 business days</SelectItem>
                    <SelectItem value="2-3">2–3 business days</SelectItem>
                    <SelectItem value="3-5">3–5 business days</SelectItem>
                    <SelectItem value="1-2weeks">1–2 weeks</SelectItem>
                    <SelectItem value="2-3weeks">2–3 weeks</SelectItem>
                    <SelectItem value="3-4weeks">3–4 weeks</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                {processingTimeOption === "custom" && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="processingDaysMin">Min (days)</Label>
                      <Input
                        id="processingDaysMin"
                        type="number"
                        min="1"
                        max="20"
                        value={processingDaysMin}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setProcessingDaysMin(
                            Math.min(Math.max(value, 1), processingDaysMax)
                          );
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="processingDaysMax">Max (days)</Label>
                      <Input
                        id="processingDaysMax"
                        type="number"
                        min="1"
                        max="20"
                        value={processingDaysMax}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setProcessingDaysMax(
                            Math.max(Math.min(value, 20), processingDaysMin)
                          );
                        }}
                        required
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Processing time is the time it takes you to prepare an order
                  before shipping.
                </p>
              </div>
            </div>

            <Separator />

            {/* Section 4: Shipping Destinations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold">
                  Shipping Destinations
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDestinationRow}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Destination
                </Button>
              </div>

              {destinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add at least one destination to configure shipping rates.
                </p>
              ) : (
                <div className="space-y-4">
                  {destinations.map((dest, index) => (
                    <Card key={dest.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium">
                            Destination {index + 1}
                          </h5>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDestinationRow(dest.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Location</Label>
                          <Select
                            value={dest.location}
                            onValueChange={(value: DestinationLocation) =>
                              updateDestinationRow(dest.id, {
                                location: value,
                                countryCode:
                                  value === "country"
                                    ? undefined
                                    : dest.countryCode,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="domestic">
                                Domestic (same country as origin)
                              </SelectItem>
                              <SelectItem value="everywhere_else">
                                Everywhere else
                              </SelectItem>
                              <SelectItem value="country">
                                Specific country
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {dest.location === "country" && (
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <CountrySelect
                              value={dest.countryCode || ""}
                              onValueChange={(value) =>
                                updateDestinationRow(dest.id, {
                                  countryCode: value,
                                })
                              }
                              placeholder="Select country"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`free-${dest.id}`}
                            checked={dest.freeShipping}
                            onCheckedChange={(checked) =>
                              updateDestinationRow(dest.id, {
                                freeShipping: checked as boolean,
                              })
                            }
                          />
                          <Label
                            htmlFor={`free-${dest.id}`}
                            className="cursor-pointer"
                          >
                            Free shipping
                          </Label>
                        </div>

                        {!dest.freeShipping && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>First Item Price</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={dest.firstItemPrice}
                                  onChange={(e) =>
                                    updateDestinationRow(dest.id, {
                                      firstItemPrice: e.target.value,
                                    })
                                  }
                                  placeholder="0.00"
                                  required={!dest.freeShipping}
                                />
                                <Select
                                  value={dest.currency}
                                  onValueChange={(value) =>
                                    updateDestinationRow(dest.id, {
                                      currency: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="NPR">NPR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Each Additional Item</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={dest.additionalItemPrice}
                                  onChange={(e) =>
                                    updateDestinationRow(dest.id, {
                                      additionalItemPrice: e.target.value,
                                    })
                                  }
                                  placeholder="0.00"
                                  required
                                />
                                <Select
                                  value={dest.currency}
                                  onValueChange={(value) =>
                                    updateDestinationRow(dest.id, {
                                      currency: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="NPR">NPR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Estimated Delivery: From (days)</Label>
                            <Input
                              type="number"
                              min="1"
                              value={dest.minDeliveryDays}
                              onChange={(e) =>
                                updateDestinationRow(dest.id, {
                                  minDeliveryDays: e.target.value,
                                })
                              }
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>To (days)</Label>
                            <Input
                              type="number"
                              min="1"
                              value={dest.maxDeliveryDays}
                              onChange={(e) =>
                                updateDestinationRow(dest.id, {
                                  maxDeliveryDays: e.target.value,
                                })
                              }
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Section 5: Shipping Upgrades (Optional) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold">
                  Shipping Upgrades (Optional)
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addUpgradeRow}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Upgrade
                </Button>
              </div>

              {upgrades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add shipping upgrades like &quot;Express shipping&quot; for
                  faster delivery options.
                </p>
              ) : (
                <div className="space-y-4">
                  {upgrades.map((upgrade, index) => (
                    <Card key={upgrade.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium">
                            Upgrade {index + 1}
                          </h5>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUpgradeRow(upgrade.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label>Upgrade Name</Label>
                          <Input
                            value={upgrade.name}
                            onChange={(e) =>
                              updateUpgradeRow(upgrade.id, {
                                name: e.target.value,
                              })
                            }
                            placeholder="e.g., Express shipping"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Price</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={upgrade.price}
                                onChange={(e) =>
                                  updateUpgradeRow(upgrade.id, {
                                    price: e.target.value,
                                  })
                                }
                                placeholder="0.00"
                                required
                              />
                              <Select
                                value={upgrade.currency}
                                onValueChange={(value) =>
                                  updateUpgradeRow(upgrade.id, {
                                    currency: value,
                                  })
                                }
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="NPR">NPR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Min Days (optional)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={upgrade.minDays}
                                onChange={(e) =>
                                  updateUpgradeRow(upgrade.id, {
                                    minDays: e.target.value,
                                  })
                                }
                                placeholder="Optional"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Days (optional)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={upgrade.maxDays}
                                onChange={(e) =>
                                  updateUpgradeRow(upgrade.id, {
                                    maxDays: e.target.value,
                                  })
                                }
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Section 6: Default Profile */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Set as default profile
              </Label>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setMode("list");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? "Saving..."
                  : mode === "edit"
                    ? "Update Profile"
                    : "Save Shipping Profile"}
              </Button>
            </div>
          </form>
        </Card>
        </TabsContent>

        <TabsContent value="packages">
          <CustomPackagesTab />
        </TabsContent>
      </Tabs>
    );
  }

  // List view
  return (
    <Tabs defaultValue="profiles" className="space-y-6">
      <TabsList>
        <TabsTrigger value="profiles">Shipping Profiles</TabsTrigger>
        <TabsTrigger value="packages">Custom Packages</TabsTrigger>
      </TabsList>

      <TabsContent value="profiles" className="space-y-6">
        <Card className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Shipping Profiles</h3>
              <p className="text-sm text-muted-foreground">
                Create and manage shipping profiles for your products
              </p>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setMode("create");
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Profile
            </Button>
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No shipping profiles yet</p>
              <p className="text-sm">
                Create your first shipping profile to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => (
                <Card key={profile.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{profile.name}</h4>
                        {profile.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          Origin: {profile.originCountry}{" "}
                          {profile.originPostalCode}
                        </p>
                        <p>
                          Processing: {profile.processingDaysMin}-
                          {profile.processingDaysMax} days
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProfile(profile)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProfile(profile.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="packages">
        <CustomPackagesTab />
      </TabsContent>
    </Tabs>
  );
}
