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
  Image as ImageIcon,
  X,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { upsertStore } from "@/app/[locale]/actions/store";
import {
  getAllInventoryLocations,
  createInventoryLocation,
  updateInventoryLocation,
  deleteInventoryLocation,
  type InventoryLocationData,
} from "@/app/[locale]/actions/inventory";
import {
  getStore as getStorefrontStore,
  updateStoreSlug,
  updateStoreVisibility,
  getStoreBanners,
  addBannerImage,
  deleteBannerImage,
  getStoreAbout,
  updateStoreAbout,
  getStorePolicies,
  updateStorePolicies,
} from "@/app/[locale]/actions/storefront-management";
import toast from "react-hot-toast";
import { FileUploader } from "react-drag-drop-files";
import type { InventoryLocation } from "@/db/schema";
import currenciesData from "@/data/currency/currency.json";
import { CountrySelect } from "@/components/ui/country-select";
import Image from "next/image";

const fileTypes = ["JPG", "PNG", "GIF", "JPEG", "WEBP", "JFIF"];

// Use InventoryLocation from schema, omitting fields we don't need in UI
type Location = Omit<InventoryLocation, "storeId" | "createdAt" | "updatedAt">;

export default function StoreTab() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    storeName: "",
    storeCurrency: "EUR",
    unitSystem: "Metric system" as "Metric system" | "Imperial system",
    slug: "",
    visibility: "public" as "public" | "hidden",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);

  // Banner tab state
  const [banners, setBanners] = useState<
    Array<{ id: string; url: string; alt?: string; sortOrder: number }>
  >([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerAlt, setBannerAlt] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // About tab state
  const [aboutData, setAboutData] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });
  const [aboutImageFile, setAboutImageFile] = useState<File | null>(null);
  const [aboutImagePreview, setAboutImagePreview] = useState<string | null>(
    null
  );

  // Policies tab state
  const [policiesData, setPoliciesData] = useState({
    shipping: "",
    returns: "",
    cancellations: "",
    customOrders: "",
    privacy: "",
    additional: "",
  });

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
      city: "",
      state: "",
      zip: "",
      country: "",
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
      const result = await getStorefrontStore();
      if (result.success && result.result) {
        setStoreId(result.result.id);
        setFormData({
          storeName: result.result.storeName || "",
          storeCurrency: result.result.storeCurrency || "EUR",
          unitSystem:
            (result.result.unitSystem as "Metric system" | "Imperial system") ||
            "Metric system",
          slug: result.result.slug || "",
          visibility:
            (result.result.visibility as "public" | "hidden") || "public",
        });
        if (result.result.logoUrl) {
          setExistingLogoUrl(result.result.logoUrl);
          setLogoPreview(result.result.logoUrl);
        }
        setIsApproved(result.result.isApproved || false);

        // Load banners
        const bannersResult = await getStoreBanners();
        if (bannersResult.success && bannersResult.banners) {
          setBanners(
            bannersResult.banners.map((b) => ({
              id: b.id,
              url: b.url,
              alt: b.alt || undefined,
              sortOrder: b.sortOrder,
            }))
          );
        }

        // Load about
        const aboutResult = await getStoreAbout();
        if (aboutResult.success && aboutResult.about) {
          setAboutData({
            title: aboutResult.about.title || "",
            description: aboutResult.about.description || "",
            imageUrl: aboutResult.about.imageUrl || "",
          });
          if (aboutResult.about.imageUrl) {
            setAboutImagePreview(aboutResult.about.imageUrl);
          }
        }

        // Load policies
        const policiesResult = await getStorePolicies();
        if (policiesResult.success && policiesResult.policies) {
          setPoliciesData({
            shipping: policiesResult.policies.shipping || "",
            returns: policiesResult.policies.returns || "",
            cancellations: policiesResult.policies.cancellations || "",
            customOrders: policiesResult.policies.customOrders || "",
            privacy: policiesResult.policies.privacy || "",
            additional: policiesResult.policies.additional || "",
          });
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

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, slug: value }));
    setSlugError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate that at least one location has all required fields
      const completeLocations = locations.filter(
        (loc) =>
          loc.name &&
          loc.address &&
          loc.city &&
          loc.zip &&
          loc.country &&
          loc.isActive
      );

      if (completeLocations.length === 0) {
        toast.error(
          "At least one active location with complete address information (name, address, city, zip, country) is required before saving the store."
        );
        setIsLoading(false);
        return;
      }

      // Update slug if changed
      if (storeId && formData.slug) {
        const slugResult = await updateStoreSlug(storeId, formData.slug);
        if (!slugResult.success) {
          setSlugError(slugResult.error || "Failed to update slug");
          setIsLoading(false);
          return;
        }
      }

      // Update visibility if changed
      if (storeId) {
        const visibilityResult = await updateStoreVisibility(
          storeId,
          formData.visibility
        );
        if (!visibilityResult.success) {
          toast.error(visibilityResult.error || "Failed to update visibility");
          setIsLoading(false);
          return;
        }
      }

      // Update other store fields
      const result = await upsertStore(
        {
          storeName: formData.storeName,
          storeCurrency: formData.storeCurrency,
          unitSystem: formData.unitSystem,
        },
        logoFile || undefined
      );
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

  const handleBannerUpload = async () => {
    if (!bannerFile || !storeId) return;

    setUploadingBanner(true);
    try {
      const result = await addBannerImage(storeId, bannerFile, bannerAlt);
      if (result.success) {
        toast.success("Banner added successfully");
        setBannerFile(null);
        setBannerAlt("");
        await loadStoreData();
      } else {
        toast.error(result.error || "Failed to add banner");
      }
    } catch (error) {
      console.error("Error uploading banner:", error);
      toast.error("Failed to upload banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const result = await deleteBannerImage(bannerId);
      if (result.success) {
        toast.success("Banner deleted successfully");
        await loadStoreData();
      } else {
        toast.error(result.error || "Failed to delete banner");
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
      toast.error("Failed to delete banner");
    }
  };

  const handleAboutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;

    setIsLoading(true);
    try {
      const result = await updateStoreAbout(
        storeId,
        {
          title: aboutData.title,
          description: aboutData.description,
          imageUrl: aboutImageFile ? undefined : aboutData.imageUrl,
        },
        aboutImageFile || undefined
      );

      if (result.success) {
        toast.success("About section updated successfully");
        await loadStoreData();
      } else {
        toast.error(result.error || "Failed to update about section");
      }
    } catch (error) {
      console.error("Error updating about:", error);
      toast.error("Failed to update about section");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoliciesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;

    setIsLoading(true);
    try {
      const result = await updateStorePolicies(storeId, policiesData);
      if (result.success) {
        toast.success("Policies updated successfully");
      } else {
        toast.error(result.error || "Failed to update policies");
      }
    } catch (error) {
      console.error("Error updating policies:", error);
      toast.error("Failed to update policies");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !locationFormData.name ||
      !locationFormData.address ||
      !locationFormData.city ||
      !locationFormData.zip ||
      !locationFormData.country
    ) {
      toast.error(
        "Please fill in all required fields: Name, Address, City, ZIP/Postal Code, and Country"
      );
      return;
    }

    // Validate state for US addresses
    if (locationFormData.country === "US" && !locationFormData.state) {
      toast.error("State/Province is required for US addresses");
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
          city: "",
          state: "",
          zip: "",
          country: "",
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
      city: location.city || "",
      state: location.state || "",
      zip: location.zip || "",
      country: location.country || "",
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="banner">Banner</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-8">
          <Card className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Store Information</h3>
                <p className="text-sm text-muted-foreground">
                  Manage your store details and settings
                </p>
              </div>
              {isApproved ? (
                <Badge className="bg-green-500">Approved</Badge>
              ) : (
                <Badge className="bg-orange-500">Pending</Badge>
              )}
            </div>
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
                  <Label htmlFor="slug" className="text-sm font-medium">
                    Store Slug *
                  </Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    placeholder="my-store-name"
                    required
                    className="h-11"
                  />
                  {slugError && (
                    <p className="text-sm text-destructive">{slugError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your store URL: /store/{formData.slug || "your-slug"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="storeCurrency"
                    className="text-sm font-medium"
                  >
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
                      <SelectItem value="Metric system">
                        Metric system
                      </SelectItem>
                      <SelectItem value="Imperial system">
                        Imperial system
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Store Logo</Label>
                  <div className="flex items-start gap-4">
                    {logoPreview && (
                      <div className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                        <Image
                          width={96}
                          height={96}
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover rounded-lg"
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
                            JPG, PNG, GIF, JPEG, WEBP, JFIF (max 5MB)
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
            <Button
              onClick={() => {
                setShowLocationForm(true);
                setEditingLocationId(null);
                setLocationFormData({
                  name: "",
                  address: "",
                  city: "",
                  state: "",
                  zip: "",
                  country: "",
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
                    <Label htmlFor="locationAddress">Street Address *</Label>
                    <Input
                      id="locationAddress"
                      value={locationFormData.address}
                      onChange={(e) =>
                        setLocationFormData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationCity">City *</Label>
                    <Input
                      id="locationCity"
                      value={locationFormData.city}
                      onChange={(e) =>
                        setLocationFormData((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationState">
                      State/Province
                      {locationFormData.country === "US" && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id="locationState"
                      value={locationFormData.state}
                      onChange={(e) =>
                        setLocationFormData((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                      placeholder={
                        locationFormData.country === "US"
                          ? "Required (e.g., CA, NY, TX)"
                          : "Optional (e.g., Province, Region)"
                      }
                      required={locationFormData.country === "US"}
                    />
                    {locationFormData.country === "US" && (
                      <p className="text-xs text-muted-foreground">
                        Use 2-letter state code (e.g., CA, NY, TX)
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationZip">ZIP/Postal Code *</Label>
                    <Input
                      id="locationZip"
                      value={locationFormData.zip}
                      onChange={(e) =>
                        setLocationFormData((prev) => ({
                          ...prev,
                          zip: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationCountry">Country *</Label>
                    <CountrySelect
                      value={locationFormData.country || ""}
                      onValueChange={(value) =>
                        setLocationFormData((prev) => ({
                          ...prev,
                          country: value,
                        }))
                      }
                      placeholder="Select a country"
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
              No inventory locations yet. Add your first location to get
              started.
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
                      {(location.city || location.state || location.zip) && (
                        <p className="text-sm text-gray-600">
                          {[location.city, location.state, location.zip]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {location.country && (
                        <p className="text-sm text-gray-600">
                          {location.country}
                        </p>
                      )}
                      {location.phone && (
                        <p className="text-sm text-gray-600">
                          {location.phone}
                        </p>
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
        </TabsContent>

        {/* Banner Tab */}
        <TabsContent value="banner" className="space-y-6">
          <Card className="p-8">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4">Add Banner Image</h4>
                <div className="space-y-4">
                  <FileUploader
                    handleChange={(file) => setBannerFile(file as File)}
                    name="banner"
                    types={fileTypes}
                  >
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Drag & drop banner image here, or click to select
                      </p>
                    </div>
                  </FileUploader>
                  {bannerFile && (
                    <div className="space-y-2">
                      <Label>Alt Text (optional)</Label>
                      <Input
                        value={bannerAlt}
                        onChange={(e) => setBannerAlt(e.target.value)}
                        placeholder="Describe the image for accessibility"
                      />
                      <Button
                        onClick={handleBannerUpload}
                        disabled={uploadingBanner}
                      >
                        {uploadingBanner ? "Uploading..." : "Add Banner"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4">
                  Banner Images ({banners.length})
                </h4>
                {banners.length === 0 ? (
                  <p className="text-muted-foreground">
                    No banners yet. Add your first banner above.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {banners.map((banner, index) => (
                      <div
                        key={banner.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <GripVertical className="w-5 h-5 text-gray-400" />
                        <Image
                          width={128}
                          height={80}
                          src={banner.url}
                          alt={banner.alt || `Banner ${index + 1}`}
                          className="w-32 h-20 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Position {banner.sortOrder + 1}
                          </p>
                          {banner.alt && (
                            <p className="text-xs text-muted-foreground">
                              {banner.alt}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBanner(banner.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about" className="space-y-6">
          <Card className="p-8">
            <form onSubmit={handleAboutSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="aboutTitle">Title (optional)</Label>
                <Input
                  id="aboutTitle"
                  value={aboutData.title}
                  onChange={(e) =>
                    setAboutData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="About Our Store"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aboutDescription">Description</Label>
                <Textarea
                  id="aboutDescription"
                  value={aboutData.description}
                  onChange={(e) =>
                    setAboutData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Tell customers about your store..."
                  rows={8}
                />
              </div>

              <div className="space-y-2">
                <Label>About Image (optional)</Label>
                {aboutImagePreview && (
                  <div className="relative w-48 h-32 rounded-lg border overflow-hidden mb-2">
                    <Image
                      width={192}
                      height={128}
                      src={aboutImagePreview}
                      alt="About preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <FileUploader
                  handleChange={(file) => {
                    setAboutImageFile(file as File);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setAboutImagePreview(reader.result as string);
                    };
                    reader.readAsDataURL(file as File);
                  }}
                  name="aboutImage"
                  types={fileTypes}
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500">
                    <ImageIcon className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Upload image</p>
                  </div>
                </FileUploader>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-6">
          <Card className="p-8">
            <form onSubmit={handlePoliciesSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="shipping">Shipping Policy</Label>
                <Textarea
                  id="shipping"
                  value={policiesData.shipping}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      shipping: e.target.value,
                    }))
                  }
                  placeholder="Describe your shipping policy..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="returns">Returns & Refunds</Label>
                <Textarea
                  id="returns"
                  value={policiesData.returns}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      returns: e.target.value,
                    }))
                  }
                  placeholder="Describe your return policy..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancellations">Cancellations</Label>
                <Textarea
                  id="cancellations"
                  value={policiesData.cancellations}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      cancellations: e.target.value,
                    }))
                  }
                  placeholder="Describe your cancellation policy..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customOrders">Custom Orders</Label>
                <Textarea
                  id="customOrders"
                  value={policiesData.customOrders}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      customOrders: e.target.value,
                    }))
                  }
                  placeholder="Describe your custom order policy..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy">Privacy Policy</Label>
                <Textarea
                  id="privacy"
                  value={policiesData.privacy}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      privacy: e.target.value,
                    }))
                  }
                  placeholder="Describe your privacy policy..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional">Additional Policies</Label>
                <Textarea
                  id="additional"
                  value={policiesData.additional}
                  onChange={(e) =>
                    setPoliciesData((prev) => ({
                      ...prev,
                      additional: e.target.value,
                    }))
                  }
                  placeholder="Any additional policies..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        {/* Visibility Tab */}
        <TabsContent value="visibility" className="space-y-6">
          <Card className="p-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">
                    Store Visibility
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.visibility === "public"
                      ? "Your store is visible to everyone and appears in the stores directory"
                      : "Your store is hidden and only accessible via direct link"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {formData.visibility === "public" ? (
                    <Eye className="w-5 h-5 text-green-600" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  )}
                  <Switch
                    checked={formData.visibility === "public"}
                    onCheckedChange={(checked) => {
                      setFormData((prev) => ({
                        ...prev,
                        visibility: checked ? "public" : "hidden",
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={async () => {
                    if (!storeId) return;
                    setIsLoading(true);
                    try {
                      const result = await updateStoreVisibility(
                        storeId,
                        formData.visibility
                      );
                      if (result.success) {
                        toast.success(
                          `Store is now ${
                            formData.visibility === "public"
                              ? "public"
                              : "hidden"
                          }`
                        );
                      } else {
                        toast.error(
                          result.error || "Failed to update visibility"
                        );
                      }
                    } catch (error) {
                      console.error("Error updating visibility:", error);
                      toast.error("Failed to update visibility");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Visibility Settings"}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
