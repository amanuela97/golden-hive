"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Store,
  Image as ImageIcon,
  X,
  Plus,
  MapPin,
  Edit,
  Trash2,
} from "lucide-react";
import { upsertStore, getStore } from "@/app/[locale]/actions/store";
import {
  getAllInventoryLocations,
  createInventoryLocation,
  updateInventoryLocation,
  deleteInventoryLocation,
  type InventoryLocationData,
} from "@/app/[locale]/actions/inventory";
import toast from "react-hot-toast";
import { FileUploader } from "react-drag-drop-files";
import type { InventoryLocation } from "@/db/schema";
import currenciesData from "@/data/currency/currency.json";

const fileTypes = ["JPG", "PNG", "GIF", "JPEG", "WEBP"];

// Use InventoryLocation from schema, omitting fields we don't need in UI
type Location = Omit<InventoryLocation, "storeId" | "createdAt" | "updatedAt">;

export default function StoreTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    storeName: "",
    description: "",
    storeCurrency: "EUR",
    unitSystem: "Metric system" as "Metric system" | "Imperial system",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // Location management state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(
    null
  );
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationFormData, setLocationFormData] =
    useState<InventoryLocationData>({
      name: "",
      address: "",
      phone: "",
      fulfillmentRules: "",
      isActive: true,
    });
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  useEffect(() => {
    loadStoreData();
    loadLocations();
  }, []);

  const loadStoreData = async () => {
    setLoadingData(true);
    try {
      const result = await getStore();
      if (result.success && result.result) {
        setFormData({
          storeName: result.result.storeName || "",
          description: result.result.description || "",
          storeCurrency: result.result.storeCurrency || "EUR",
          unitSystem:
            (result.result.unitSystem as "Metric system" | "Imperial system") ||
            "Metric system",
        });
        if (result.result.logoUrl) {
          setExistingLogoUrl(result.result.logoUrl);
          setLogoPreview(result.result.logoUrl);
        }
      }
    } catch (error) {
      console.error("Error loading store data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadLocations = async () => {
    setLoadingLocations(true);
    try {
      const result = await getAllInventoryLocations();
      if (result.success && result.result) {
        setLocations(result.result as Location[]);
      }
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogoChange = (file: File) => {
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(existingLogoUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await upsertStore(formData, logoFile || undefined);
      if (result.success) {
        toast.success("Store updated successfully");
        await loadStoreData();
      } else {
        toast.error(result.error || "Failed to update store");
      }
    } catch (error) {
      console.error("Error updating store:", error);
      toast.error("Failed to update store");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLocation(true);

    try {
      let result;
      if (editingLocationId) {
        result = await updateInventoryLocation(
          editingLocationId,
          locationFormData
        );
      } else {
        result = await createInventoryLocation(locationFormData);
      }

      if (result.success) {
        toast.success(
          editingLocationId
            ? "Location updated successfully"
            : "Location created successfully"
        );
        setShowLocationForm(false);
        setEditingLocationId(null);
        setLocationFormData({
          name: "",
          address: "",
          phone: "",
          fulfillmentRules: "",
          isActive: true,
        });
        await loadLocations();
      } else {
        toast.error(result.error || "Failed to save location");
      }
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocationId(location.id);
    setLocationFormData({
      name: location.name || "",
      address: location.address || "",
      phone: location.phone || "",
      fulfillmentRules: location.fulfillmentRules || "",
      isActive: location.isActive ?? true,
    });
    setShowLocationForm(true);
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm("Are you sure you want to delete this location?")) {
      return;
    }

    try {
      const result = await deleteInventoryLocation(locationId);
      if (result.success) {
        toast.success("Location deleted successfully");
        await loadLocations();
      } else {
        toast.error(result.error || "Failed to delete location");
      }
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("Failed to delete location");
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Store Information Section */}
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-semibold">Store Information</h3>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="storeName" className="text-sm font-medium">
                Store Name *
              </Label>
              <Input
                id="storeName"
                name="storeName"
                value={formData.storeName}
                onChange={handleInputChange}
                placeholder="Enter your store name"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeCurrency" className="text-sm font-medium">
                Store Currency *
              </Label>
              <Select
                value={formData.storeCurrency}
                onValueChange={(value) =>
                  handleSelectChange("storeCurrency", value)
                }
                required
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currenciesData.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitSystem" className="text-sm font-medium">
                Unit System *
              </Label>
              <Select
                value={formData.unitSystem}
                onValueChange={(value) =>
                  handleSelectChange(
                    "unitSystem",
                    value as "Metric system" | "Imperial system"
                  )
                }
                required
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select unit system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Metric system">Metric system</SelectItem>
                  <SelectItem value="Imperial system">
                    Imperial system
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter a short description about your store"
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label className="text-sm font-medium">Store Logo</Label>
              <div className="flex items-start gap-4">
                {logoPreview && (
                  <div className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <FileUploader
                    handleChange={(file) => handleLogoChange(file as File)}
                    name="logo"
                    types={fileTypes}
                    classes="w-full"
                  >
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Drag & drop logo here, or click to select
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        JPG, PNG, GIF, JPEG, WEBP (max 5MB)
                      </p>
                    </div>
                  </FileUploader>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Inventory Locations Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold">Inventory Locations</h3>
        </div>
        <Button
          onClick={() => {
            setShowLocationForm(true);
            setEditingLocationId(null);
            setLocationFormData({
              name: "",
              address: "",
              phone: "",
              fulfillmentRules: "",
              isActive: true,
            });
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      {showLocationForm && (
        <Card className="p-6">
          <form onSubmit={handleLocationSubmit} className="space-y-4">
            <h4 className="font-semibold">
              {editingLocationId ? "Edit Location" : "Add New Location"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="locationName">Name *</Label>
                <Input
                  id="locationName"
                  value={locationFormData.name}
                  onChange={(e) =>
                    setLocationFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationPhone">Phone</Label>
                <Input
                  id="locationPhone"
                  value={locationFormData.phone}
                  onChange={(e) =>
                    setLocationFormData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="locationAddress">Address</Label>
                <Input
                  id="locationAddress"
                  value={locationFormData.address}
                  onChange={(e) =>
                    setLocationFormData((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="locationRules">Fulfillment Rules</Label>
                <Textarea
                  id="locationRules"
                  value={locationFormData.fulfillmentRules}
                  onChange={(e) =>
                    setLocationFormData((prev) => ({
                      ...prev,
                      fulfillmentRules: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLocationForm(false);
                  setEditingLocationId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingLocation}>
                {isSavingLocation ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loadingLocations ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : locations.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No inventory locations yet. Add your first location to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <Card key={location.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">{location.name}</h4>
                  {location.address && (
                    <p className="text-sm text-gray-600 mt-1">
                      {location.address}
                    </p>
                  )}
                  {location.phone && (
                    <p className="text-sm text-gray-600">{location.phone}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditLocation(location)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLocation(location.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              {location.fulfillmentRules && (
                <p className="text-xs text-gray-500 mt-2">
                  {location.fulfillmentRules}
                </p>
              )}
              <div className="mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    location.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {location.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
