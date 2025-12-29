"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import Image from "next/image";

const fileTypes = ["JPG", "PNG", "GIF", "JPEG", "WEBP"];

// Use InventoryLocation from schema, omitting fields we don't need in UI
type Location = Omit<InventoryLocation, "storeId" | "createdAt" | "updatedAt">;

export default function StoreTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    storeName: "",
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
        setLocations(result.result);
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

  const handleLocationInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setLocationFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(existingLogoUrl);
      return;
    }

    // Validate file type
    if (!fileTypes.includes(file.name.split(".").pop()?.toUpperCase() || "")) {
      toast.error(
        "Please select a valid image file (JPG, PNG, GIF, JPEG, WEBP)"
      );
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(existingLogoUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.storeName.trim()) {
      toast.error("Store name is required");
      return;
    }

    setIsLoading(true);
    try {
      const result = await upsertStore(
        {
          storeName: formData.storeName.trim(),
          logoUrl: existingLogoUrl,
          storeCurrency: "EUR",
          unitSystem: "Metric system",
        },
        logoFile || undefined
      );

      if (result.success) {
        toast.success(result.message || "Store updated successfully");
        // Update existing logo URL if a new one was uploaded
        if (logoFile && logoPreview && !logoPreview.startsWith("blob:")) {
          // The logo URL will be returned from the server, but for now we'll reload
          await loadStoreData();
        }
      } else {
        toast.error(result.error || "Failed to update store");
      }
    } catch (error) {
      console.error("Store update error:", error);
      toast.error("Failed to update store");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLocation = () => {
    setEditingLocationId(null);
    setShowLocationForm(true);
    setLocationFormData({
      name: "",
      address: "",
      phone: "",
      fulfillmentRules: "",
      isActive: true,
    });
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocationId(location.id);
    setShowLocationForm(true);
    setLocationFormData({
      name: location.name,
      address: location.address || "",
      phone: location.phone || "",
      fulfillmentRules: location.fulfillmentRules || "",
      isActive: location.isActive ?? true,
    });
  };

  const handleCancelLocation = () => {
    setEditingLocationId(null);
    setShowLocationForm(false);
    setLocationFormData({
      name: "",
      address: "",
      phone: "",
      fulfillmentRules: "",
      isActive: true,
    });
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!locationFormData.name.trim()) {
      toast.error("Location name is required");
      return;
    }

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
        toast.success(result.message || "Location saved successfully");
        await loadLocations();
        setShowLocationForm(false);
        handleCancelLocation();
      } else {
        toast.error(result.error || "Failed to save location");
      }
    } catch (error) {
      console.error("Location save error:", error);
      toast.error("Failed to save location");
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this location? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const result = await deleteInventoryLocation(locationId);
      if (result.success) {
        toast.success(result.message || "Location deleted successfully");
        await loadLocations();
      } else {
        toast.error(result.error || "Failed to delete location");
      }
    } catch (error) {
      console.error("Location delete error:", error);
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

            <div className="lg:col-span-2 space-y-2">
              <Label className="text-sm font-medium">Store Logo</Label>
              <div className="space-y-4">
                {logoPreview && (
                  <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                    <Image
                      width={128}
                      height={128}
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <FileUploader
                  handleChange={(file) => handleFileChange(file as File)}
                  name="logo"
                  types={fileTypes}
                  maxSize={5}
                  hoverTitle="Drop logo here"
                  label="Drag & drop logo here or click to browse"
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Drag & drop logo here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      JPG, PNG, GIF, JPEG, WEBP (max 5MB)
                    </p>
                  </div>
                </FileUploader>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              <Save className="w-4 h-4 mr-2" />
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Inventory Locations Section */}
      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold">Inventory Locations</h3>
          </div>
          {!showLocationForm && (
            <Button type="button" onClick={handleAddLocation} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>

        {/* Location Form */}
        {showLocationForm && (
          <Card className="p-6 mb-6">
            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="locationName" className="text-sm font-medium">
                    Location Name *
                  </Label>
                  <Input
                    id="locationName"
                    name="name"
                    value={locationFormData.name}
                    onChange={handleLocationInputChange}
                    placeholder="e.g., Main Warehouse, Helsinki Store"
                    required
                    className="h-11"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label
                    htmlFor="locationAddress"
                    className="text-sm font-medium"
                  >
                    Address
                  </Label>
                  <Textarea
                    id="locationAddress"
                    name="address"
                    value={locationFormData.address}
                    onChange={handleLocationInputChange}
                    placeholder="Enter the location address"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="locationPhone"
                    className="text-sm font-medium"
                  >
                    Phone / Contact
                  </Label>
                  <Input
                    id="locationPhone"
                    name="phone"
                    value={locationFormData.phone}
                    onChange={handleLocationInputChange}
                    placeholder="Enter phone number or contact"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="locationFulfillmentRules"
                    className="text-sm font-medium"
                  >
                    Fulfillment Rules
                  </Label>
                  <Input
                    id="locationFulfillmentRules"
                    name="fulfillmentRules"
                    value={locationFormData.fulfillmentRules}
                    onChange={handleLocationInputChange}
                    placeholder="Enter fulfillment rules"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelLocation}
                  disabled={isSavingLocation}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingLocation}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingLocation ? "Saving..." : "Save Location"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Locations List */}
        {loadingLocations ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : locations.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-gray-600">
              No locations found. Create your first location to start tracking
              inventory.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <Card key={location.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg">{location.name}</h4>
                      {!location.isActive && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    {location.address && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Address:</span>{" "}
                        {location.address}
                      </p>
                    )}
                    {location.phone && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Phone:</span>{" "}
                        {location.phone}
                      </p>
                    )}
                    {location.fulfillmentRules && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fulfillment Rules:</span>{" "}
                        {location.fulfillmentRules}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditLocation(location)}
                      disabled={showLocationForm}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteLocation(location.id)}
                      disabled={showLocationForm}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
