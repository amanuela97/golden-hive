"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Save, ArrowLeft } from "lucide-react";
import { createCustomer, updateCustomer, getVendorsForFilter } from "@/app/[locale]/actions/customers";
import toast from "react-hot-toast";
import { CountrySelect } from "@/components/ui/country-select";
import { VendorSelect } from "@/components/ui/vendor-select";
import { useRouter } from "@/i18n/navigation";

interface CustomerFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
  vendorId: string | null;
}

interface CustomerFormProps {
  initialData?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    notes: string | null;
    vendorId: string | null;
  };
  isEdit?: boolean;
  isAdmin?: boolean;
}

export function CustomerForm({
  initialData,
  isEdit = false,
  isAdmin = false,
}: CustomerFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState<CustomerFormData>({
    email: initialData?.email || "",
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    phone: initialData?.phone || "",
    addressLine1: initialData?.addressLine1 || "",
    addressLine2: initialData?.addressLine2 || "",
    city: initialData?.city || "",
    region: initialData?.region || "",
    postalCode: initialData?.postalCode || "",
    country: initialData?.country || "",
    notes: initialData?.notes || "",
    vendorId: initialData?.vendorId || null,
  });

  // Load vendors if admin
  useEffect(() => {
    if (isAdmin) {
      getVendorsForFilter().then((result) => {
        if (result.success && result.data) {
          setVendors(result.data);
        }
      });
    }
  }, [isAdmin]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCountryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      country: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert country code to full name for storage
      let countryValue = formData.country;
      if (countryValue) {
        try {
          const countries = await import("@/data/countries.json").then(
            (m) => m.default
          );
          const country = countries.find(
            (c: { value: string; label: string }) => c.value === countryValue
          );
          if (country) {
            countryValue = country.label; // Store full name in DB
          }
        } catch (error) {
          console.error("Error loading countries data:", error);
        }
      }

      if (isEdit && initialData) {
        const result = await updateCustomer(initialData.id, {
          email: formData.email,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          addressLine1: formData.addressLine1 || null,
          addressLine2: formData.addressLine2 || null,
          city: formData.city || null,
          region: formData.region || null,
          postalCode: formData.postalCode || null,
          country: countryValue || null,
          notes: formData.notes || null,
        });

        if (result.success) {
          toast.success("Customer updated successfully");
          router.push(`/dashboard/customers/${initialData.id}`);
        } else {
          toast.error(result.error || "Failed to update customer");
        }
      } else {
        const result = await createCustomer({
          email: formData.email,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          addressLine1: formData.addressLine1 || null,
          addressLine2: formData.addressLine2 || null,
          city: formData.city || null,
          region: formData.region || null,
          postalCode: formData.postalCode || null,
          country: countryValue || null,
          notes: formData.notes || null,
          vendorId: isAdmin ? (formData.vendorId || null) : null,
        });

        if (result.success && result.data) {
          toast.success("Customer created successfully");
          router.push(`/dashboard/customers/${result.data.id}`);
        } else {
          toast.error(result.error || "Failed to create customer");
        }
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert country full name to code for CountrySelect
  const getCountryCode = (countryName: string | null): string => {
    if (!countryName) return "";
    // Try to find by full name first
    try {
      const countries = require("@/data/countries.json");
      const country = countries.find(
        (c: { label: string; value: string }) => c.label === countryName
      );
      return country ? country.value : countryName; // Return code or original if not found
    } catch {
      return countryName;
    }
  };

  const countryCode = getCountryCode(formData.country);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {isEdit ? "Edit Customer" : "New Customer"}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            {isAdmin && (
              <div>
                <Label htmlFor="vendorId">Vendor</Label>
                <VendorSelect
                  value={formData.vendorId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      vendorId: value,
                    }))
                  }
                  vendors={vendors}
                  placeholder="Select vendor (optional)"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Address Information */}
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Address</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="region">Region/State</Label>
                <Input
                  id="region"
                  name="region"
                  value={formData.region}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <CountrySelect
                  value={countryCode}
                  onValueChange={handleCountryChange}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Notes */}
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Notes</h3>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleInputChange}
          placeholder="Add any additional notes about this customer..."
          rows={4}
        />
      </Card>
    </form>
  );
}

