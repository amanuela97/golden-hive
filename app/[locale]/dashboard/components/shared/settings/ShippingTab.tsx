"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { CountrySelect } from "@/components/ui/country-select";
import {
  saveShippingBillingInfo,
  getShippingBillingInfo,
} from "../../../../actions/shipping-billing";
import toast from "react-hot-toast";

export default function ShippingTab() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    // Billing
    billingFirstName: "",
    billingLastName: "",
    billingCompany: "",
    billingCountry: "",
    billingAddress: "",
    billingAddress2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingPhone: "",
    billingEmail: "",
    // Shipping
    shippingFirstName: "",
    shippingLastName: "",
    shippingCompany: "",
    shippingCountry: "",
    shippingAddress: "",
    shippingAddress2: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
  });

  useEffect(() => {
    async function loadData() {
      setFetching(true);
      const result = await getShippingBillingInfo();
      if (result.success && result.result) {
        setFormData({
          billingFirstName: result.result.billingFirstName || "",
          billingLastName: result.result.billingLastName || "",
          billingCompany: result.result.billingCompany || "",
          billingCountry: result.result.billingCountry || "",
          billingAddress: result.result.billingAddress || "",
          billingAddress2: result.result.billingAddress2 || "",
          billingCity: result.result.billingCity || "",
          billingState: result.result.billingState || "",
          billingZip: result.result.billingZip || "",
          billingPhone: result.result.billingPhone || "",
          billingEmail: result.result.billingEmail || "",
          shippingFirstName: result.result.shippingFirstName || "",
          shippingLastName: result.result.shippingLastName || "",
          shippingCompany: result.result.shippingCompany || "",
          shippingCountry: result.result.shippingCountry || "",
          shippingAddress: result.result.shippingAddress || "",
          shippingAddress2: result.result.shippingAddress2 || "",
          shippingCity: result.result.shippingCity || "",
          shippingState: result.result.shippingState || "",
          shippingZip: result.result.shippingZip || "",
        });
      }
      setFetching(false);
    }
    loadData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCountryChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await saveShippingBillingInfo(formData);
      if (result.success) {
        toast.success(result.message || "Information saved successfully");
      } else {
        toast.error(result.error || "Failed to save information");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="space-y-6">
        <Card className="p-8">
          <div className="text-center">Loading...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Billing Information */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-6">Billing Information</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingFirstName">First Name</Label>
                <Input
                  id="billingFirstName"
                  name="billingFirstName"
                  value={formData.billingFirstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingLastName">Last Name</Label>
                <Input
                  id="billingLastName"
                  name="billingLastName"
                  value={formData.billingLastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCompany">Company Name (Optional)</Label>
              <Input
                id="billingCompany"
                name="billingCompany"
                value={formData.billingCompany}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCountry">Country / Region</Label>
              <CountrySelect
                id="billingCountry"
                value={formData.billingCountry}
                onValueChange={(value) =>
                  handleCountryChange("billingCountry", value)
                }
                placeholder="Select a country"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingAddress">Street Address</Label>
              <Input
                id="billingAddress"
                name="billingAddress"
                value={formData.billingAddress}
                onChange={handleChange}
                placeholder="House number and street name"
              />
              <Input
                id="billingAddress2"
                name="billingAddress2"
                value={formData.billingAddress2}
                onChange={handleChange}
                placeholder="Apartment, suite, unit, etc. (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCity">City</Label>
              <Input
                id="billingCity"
                name="billingCity"
                value={formData.billingCity}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingState">State</Label>
                <Input
                  id="billingState"
                  name="billingState"
                  value={formData.billingState}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingZip">ZIP Code</Label>
                <Input
                  id="billingZip"
                  name="billingZip"
                  value={formData.billingZip}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingPhone">Phone</Label>
                <Input
                  id="billingPhone"
                  name="billingPhone"
                  type="tel"
                  value={formData.billingPhone}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Email</Label>
                <Input
                  id="billingEmail"
                  name="billingEmail"
                  type="email"
                  value={formData.billingEmail}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Shipping Information */}
        <Card className="p-6">
          <h4 className="text-lg font-semibold mb-6">Shipping Information</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingFirstName">First Name</Label>
                <Input
                  id="shippingFirstName"
                  name="shippingFirstName"
                  value={formData.shippingFirstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingLastName">Last Name</Label>
                <Input
                  id="shippingLastName"
                  name="shippingLastName"
                  value={formData.shippingLastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCompany">Company Name (Optional)</Label>
              <Input
                id="shippingCompany"
                name="shippingCompany"
                value={formData.shippingCompany}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCountry">Country / Region</Label>
              <CountrySelect
                id="shippingCountry"
                value={formData.shippingCountry}
                onValueChange={(value) =>
                  handleCountryChange("shippingCountry", value)
                }
                placeholder="Select a country"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingAddress">Street Address</Label>
              <Input
                id="shippingAddress"
                name="shippingAddress"
                value={formData.shippingAddress}
                onChange={handleChange}
                placeholder="House number and street name"
              />
              <Input
                id="shippingAddress2"
                name="shippingAddress2"
                value={formData.shippingAddress2}
                onChange={handleChange}
                placeholder="Apartment, suite, unit, etc. (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCity">City</Label>
              <Input
                id="shippingCity"
                name="shippingCity"
                value={formData.shippingCity}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingState">State</Label>
                <Input
                  id="shippingState"
                  name="shippingState"
                  value={formData.shippingState}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingZip">ZIP Code</Label>
                <Input
                  id="shippingZip"
                  name="shippingZip"
                  value={formData.shippingZip}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </Card>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Information"}
        </Button>
      </form>
    </div>
  );
}
