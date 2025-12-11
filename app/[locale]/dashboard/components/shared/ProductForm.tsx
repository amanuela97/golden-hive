"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Listing,
  type CreateListingData,
  type UpdateListingData,
} from "@/lib/listing";
import { Save, ArrowLeft, Image as ImageIcon, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import toast from "react-hot-toast";
import { InputTags } from "../../../components/input-tags";
import { checkSellerDocumentationForCategory } from "../../../actions/documentation";
import { useSession } from "@/lib/auth-client";
import { TaxonomyCategorySelector } from "./TaxonomyCategorySelector";
import { ProductVariants } from "./product-variants";
import { FileUploader } from "react-drag-drop-files";
import { getCategoryRuleByTaxonomyId } from "../../../actions/category-rules";
import { getInventoryLocations } from "../../../actions/inventory";
import type { VariantData } from "@/lib/listing";
import { getCategoryAttributes, type TaxonomyAttribute } from "@/lib/taxonomy";

const fileTypes = ["JPG", "PNG", "GIF", "JPEG", "WEBP"];

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Partial<Listing>;
  onSubmit: (data: CreateListingData | UpdateListingData) => Promise<void>;
  isLoading?: boolean;
  basePath: string; // e.g., "/dashboard/admin" or "/dashboard/seller"
  isAdmin?: boolean; // Whether the current user is an admin
}

// Variant type matching product-variants.tsx
type Variant = {
  id: string;
  options: Record<string, string>;
  price: string;
  quantity: string;
  sku?: string;
  barcode?: string;
  package?: string;
  weight?: string;
  origin?: string;
  images?: string[];
};

export default function ProductForm({
  mode,
  initialData,
  onSubmit,
  isLoading = false,
  basePath,
  isAdmin = false,
}: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    taxonomyCategoryId: initialData?.taxonomyCategoryId || "",
    price: initialData?.price ? parseFloat(initialData.price) : 0,
    compareAtPrice: initialData?.compareAtPrice
      ? parseFloat(initialData.compareAtPrice)
      : undefined,
    currency: initialData?.currency || "NPR",
    unit: initialData?.unit || "kg",
    status: (initialData?.status as "active" | "draft" | "archived") || "draft",
    isFeatured: initialData?.isFeatured ?? false,
    marketType: initialData?.marketType || "local",
    originVillage: initialData?.originVillage || "",
    harvestDate: initialData?.harvestDate
      ? new Date(initialData.harvestDate).toISOString().split("T")[0]
      : "",
    tags: initialData?.tags || [],
    // Inventory fields
    tracksInventory: false,
    inventoryLocationId: "",
    costPerItem: 0,
  });

  // Fetch inventory locations
  const [inventoryLocations, setInventoryLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Category attributes for recommended options
  const [categoryAttributes, setCategoryAttributes] = useState<
    TaxonomyAttribute[]
  >([]);

  useEffect(() => {
    if (mode === "create") {
      setLoadingLocations(true);
      getInventoryLocations()
        .then((result) => {
          if (result.success && result.result) {
            setInventoryLocations(result.result);
          }
        })
        .catch((error) => {
          console.error("Error fetching inventory locations:", error);
        })
        .finally(() => {
          setLoadingLocations(false);
        });
    }
  }, [mode]);

  const [tags, setTags] = useState<string[]>(initialData?.tags || []);

  const [mainImage, setMainImage] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(
    initialData?.imageUrl || null
  );

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    initialData?.gallery || []
  );

  // Variant images - stored as File[] keyed by variant ID
  const [variantImages, setVariantImages] = useState<Record<string, File[]>>(
    {}
  );
  const [variantImagePreviews, setVariantImagePreviews] = useState<
    Record<string, string[]>
  >({});

  const [showDocumentationModal, setShowDocumentationModal] = useState(false);
  const [missingDocuments, setMissingDocuments] = useState<
    { id: string; name: string }[]
  >([]);

  const { data: session } = useSession();

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleMainImageChange = (file: File | null) => {
    if (!file) {
      setMainImage(null);
      setMainImagePreview(initialData?.imageUrl || null);
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

    setMainImage(file);
    setMainImagePreview(URL.createObjectURL(file));
  };

  const handleGalleryChange = (files: File[] | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    files.forEach((file) => {
      // Validate file type
      if (
        !fileTypes.includes(file.name.split(".").pop()?.toUpperCase() || "")
      ) {
        toast.error(
          `File ${file.name} is not a valid image file (JPG, PNG, GIF, JPEG, WEBP)`
        );
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Image ${file.name} size must be less than 5MB`);
        return;
      }

      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });

    setGalleryFiles((prev) => [...prev, ...validFiles]);
    setGalleryPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);
      return newFiles;
    });
    setGalleryPreviews((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
  };

  const removeGalleryUrl = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle variant images - these are stored but not uploaded until form submit
  const handleVariantImageChange = useCallback(
    (variantId: string, files: File[] | null) => {
      if (!files || files.length === 0) {
        setVariantImages((prev) => {
          const newImages = { ...prev };
          delete newImages[variantId];
          return newImages;
        });
        setVariantImagePreviews((prev) => {
          const newPreviews = { ...prev };
          // Revoke old preview URLs
          if (newPreviews[variantId]) {
            newPreviews[variantId].forEach((url) => URL.revokeObjectURL(url));
          }
          delete newPreviews[variantId];
          return newPreviews;
        });
        return;
      }

      const validFiles: File[] = [];
      const newPreviews: string[] = [];

      files.forEach((file) => {
        // Validate file type
        if (
          !fileTypes.includes(file.name.split(".").pop()?.toUpperCase() || "")
        ) {
          toast.error(
            `File ${file.name} is not a valid image file (JPG, PNG, GIF, JPEG, WEBP)`
          );
          return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`Image ${file.name} size must be less than 5MB`);
          return;
        }

        validFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      });

      setVariantImages((prev) => ({
        ...prev,
        [variantId]: validFiles,
      }));
      setVariantImagePreviews((prev) => ({
        ...prev,
        [variantId]: newPreviews,
      }));
    },
    []
  );

  const removeVariantImage = (variantId: string, index: number) => {
    setVariantImages((prev) => {
      const images = prev[variantId] || [];
      return {
        ...prev,
        [variantId]: images.filter((_, i) => i !== index),
      };
    });
    setVariantImagePreviews((prev) => {
      const previews = prev[variantId] || [];
      URL.revokeObjectURL(previews[index]);
      return {
        ...prev,
        [variantId]: previews.filter((_, i) => i !== index),
      };
    });
  };

  // Get variants from ProductVariants component
  // Note: Variants are now stored in listing_variants table, not in listing
  // For edit mode, we'd need to fetch variants separately
  const [variants, setVariants] = useState<Variant[]>([]);

  // Memoize the callback to prevent unnecessary re-renders
  const handleVariantsChange = useCallback((newVariants: Variant[]) => {
    setVariants(newVariants);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    // Validate required fields for creation
    if (mode === "create") {
      if (!session?.user?.id) {
        toast.error("You must be logged in to create a product");
        return;
      }

      if (!formData.taxonomyCategoryId) {
        toast.error("Please select a category");
        return;
      }

      // Try to fetch categoryRuleId from taxonomyCategoryId (optional - category may not have rules)
      let categoryRuleId: string | undefined = undefined;
      try {
        const categoryRuleResult = await getCategoryRuleByTaxonomyId(
          formData.taxonomyCategoryId
        );

        if (categoryRuleResult.success && categoryRuleResult.result) {
          categoryRuleId = categoryRuleResult.result.id;
        }
        // If no rule exists, that's okay - the category just doesn't have documentation requirements
      } catch (error) {
        console.error("Error fetching category rule:", error);
        // Continue without categoryRuleId - it's optional
      }

      // Check for required documentation if creating a new product and taxonomy category is selected
      // Skip documentation check for admin users
      if (!isAdmin) {
        try {
          const docCheck = await checkSellerDocumentationForCategory(
            session.user.id,
            formData.taxonomyCategoryId
          );

          if (docCheck.success && docCheck.result) {
            if (
              !docCheck.result.hasAllRequired &&
              docCheck.result.missingDocuments.length > 0
            ) {
              setMissingDocuments(docCheck.result.missingDocuments);
              setShowDocumentationModal(true);
              return;
            }
          }
        } catch (error) {
          console.error("Error checking documentation:", error);
          // Continue with submission if documentation check fails
        }
      }

      // Validate variants: max 100 variants
      if (variants.length > 100) {
        toast.error("Maximum 100 variants allowed per product");
        return;
      }

      // Validate inventory location if tracking inventory
      if (formData.tracksInventory && !formData.inventoryLocationId) {
        toast.error(
          "Please select an inventory location when tracking inventory"
        );
        return;
      }

      try {
        // Convert variants from ProductVariants format to VariantData format
        const variantData: VariantData[] = variants.map((variant) => ({
          id: variant.id,
          title: Object.values(variant.options).join(" / ") || "Default",
          sku: variant.sku,
          price: parseFloat(variant.price) || formData.price,
          compareAtPrice: undefined, // Can be added later if needed
          imageUrl: variant.images?.[0],
          options: variant.options,
          initialStock: formData.tracksInventory
            ? parseInt(variant.quantity) || 0
            : undefined,
          costPerItem:
            formData.costPerItem > 0 ? formData.costPerItem : undefined,
        }));

        const baseData = {
          ...formData,
          producerId: session.user.id, // Set automatically from session
          categoryRuleId: categoryRuleId, // Optional - only set if category rule exists
          taxonomyCategoryId: formData.taxonomyCategoryId, // Already set by user
          tags,
          compareAtPrice: formData.compareAtPrice || undefined,
          harvestDate: formData.harvestDate
            ? new Date(formData.harvestDate)
            : undefined,
          variants: variantData.length > 0 ? variantData : undefined,
          tracksInventory: formData.tracksInventory,
          inventoryLocationId: formData.inventoryLocationId || undefined,
          variantImages:
            Object.keys(variantImages).length > 0 ? variantImages : undefined,
        };

        const submitData: CreateListingData = {
          ...baseData,
          mainImage: mainImage || undefined,
          galleryFiles: galleryFiles.length > 0 ? galleryFiles : undefined,
          gallery: galleryUrls.length > 0 ? galleryUrls : undefined,
        };

        await onSubmit(submitData);
      } catch (error) {
        toast.error("Failed to create product");
        console.error("Submit error:", error);
      }
    } else {
      // Edit mode
      if (!initialData?.id) {
        toast.error("Product ID is required for editing");
        return;
      }

      try {
        // Convert variants from ProductVariants format to VariantData format
        const variantData: VariantData[] = variants.map((variant) => ({
          id: variant.id,
          title: Object.values(variant.options).join(" / ") || "Default",
          sku: variant.sku,
          price: parseFloat(variant.price) || formData.price,
          compareAtPrice: undefined,
          imageUrl: variant.images?.[0],
          options: variant.options,
        }));

        const baseData = {
          ...formData,
          tags,
          compareAtPrice: formData.compareAtPrice || undefined,
          harvestDate: formData.harvestDate
            ? new Date(formData.harvestDate)
            : undefined,
          variants: variantData.length > 0 ? variantData : undefined,
          variantImages:
            Object.keys(variantImages).length > 0 ? variantImages : undefined,
        };

        // If taxonomyCategoryId changed, try to fetch new categoryRuleId (optional)
        let categoryRuleId = initialData.categoryRuleId;
        if (
          formData.taxonomyCategoryId &&
          formData.taxonomyCategoryId !== initialData.taxonomyCategoryId
        ) {
          try {
            const categoryRuleResult = await getCategoryRuleByTaxonomyId(
              formData.taxonomyCategoryId
            );

            if (categoryRuleResult.success && categoryRuleResult.result) {
              categoryRuleId = categoryRuleResult.result.id;
            } else {
              // No rule exists for this category - that's okay, set to undefined
              categoryRuleId = undefined;
            }
          } catch (error) {
            console.error("Error fetching category rule:", error);
            // Continue without categoryRuleId - it's optional
            categoryRuleId = undefined;
          }
        }

        const submitData: UpdateListingData = {
          ...baseData,
          id: initialData.id,
          categoryRuleId: categoryRuleId || undefined,
          taxonomyCategoryId: formData.taxonomyCategoryId || undefined,
          mainImage: mainImage || undefined,
          galleryFiles: galleryFiles.length > 0 ? galleryFiles : undefined,
          gallery: galleryUrls.length > 0 ? galleryUrls : undefined,
        };

        await onSubmit(submitData);
      } catch (error) {
        toast.error("Failed to update product");
        console.error("Submit error:", error);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${basePath}/products`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {mode === "create" ? "Add New Product" : "Edit Product"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Himalayan Mad Honey"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe your product..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
                <TaxonomyCategorySelector
                  value={formData.taxonomyCategoryId}
                  onChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      taxonomyCategoryId: value,
                    }));
                    // Fetch attributes for the selected category
                    if (value) {
                      const attributes = getCategoryAttributes(value);
                      setCategoryAttributes(attributes);
                    } else {
                      setCategoryAttributes([]);
                    }
                  }}
                  label="Category"
                  description="Type to search and select a category from the taxonomy"
                />
                <div>
                  <Label htmlFor="originVillage">Origin Village</Label>
                  <Input
                    id="originVillage"
                    name="originVillage"
                    value={formData.originVillage}
                    onChange={handleInputChange}
                    placeholder="e.g., Manang"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="tags">Tags</Label>
                  <InputTags
                    value={tags}
                    onChange={setTags}
                    placeholder="Add tags (press Enter or comma to add)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Add relevant tags to help customers find your product
                  </p>
                </div>
              </div>
            </Card>

            {/* Pricing & Inventory */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Pricing & Inventory
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="compareAtPrice">Compare at Price</Label>
                  <Input
                    id="compareAtPrice"
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.compareAtPrice || ""}
                    onChange={handleInputChange}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Original price before discount (shown crossed out)
                  </p>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NPR">NPR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <select
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="bottle">bottle</option>
                    <option value="jar">jar</option>
                    <option value="piece">piece</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="harvestDate">Harvest Date</Label>
                  <Input
                    id="harvestDate"
                    name="harvestDate"
                    type="date"
                    value={formData.harvestDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="marketType">Market Type</Label>
                  <select
                    id="marketType"
                    name="marketType"
                    value={formData.marketType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="local">Local</option>
                    <option value="international">International</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Inventory Settings */}
            {mode === "create" && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Inventory Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="tracksInventory"
                      name="tracksInventory"
                      checked={formData.tracksInventory}
                      onChange={handleCheckboxChange}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="tracksInventory">
                      Track inventory for this product
                    </Label>
                  </div>

                  {formData.tracksInventory && (
                    <>
                      <div>
                        <Label htmlFor="inventoryLocationId">
                          Inventory Location *
                        </Label>
                        <select
                          id="inventoryLocationId"
                          name="inventoryLocationId"
                          value={formData.inventoryLocationId}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={formData.tracksInventory}
                          disabled={loadingLocations}
                        >
                          <option value="">
                            {loadingLocations
                              ? "Loading locations..."
                              : "Select location"}
                          </option>
                          {inventoryLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                        {inventoryLocations.length === 0 &&
                          !loadingLocations && (
                            <p className="text-sm text-gray-500 mt-1">
                              No inventory locations found. Please create one in
                              Settings.
                            </p>
                          )}
                      </div>

                      <div>
                        <Label htmlFor="costPerItem">
                          Cost per Item (Optional)
                        </Label>
                        <Input
                          id="costPerItem"
                          name="costPerItem"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.costPerItem}
                          onChange={handleInputChange}
                          placeholder="0.00"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Cost of goods sold (COGS) for accounting
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Variants */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Product Variants</h2>
              <ProductVariants
                initialVariants={variants}
                onVariantsChange={handleVariantsChange}
                onVariantImageChange={handleVariantImageChange}
                variantImagePreviews={variantImagePreviews}
                onRemoveVariantImage={removeVariantImage}
                recommendedAttributes={categoryAttributes}
              />
            </Card>

            {/* Status */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Status & Visibility
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="status">Product Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "active" | "draft" | "archived") => {
                      setFormData((prev) => ({ ...prev, status: value }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div>
                          <div className="font-medium">Active</div>
                          <div className="text-xs text-gray-500">
                            Product is visible to customers and can be purchased
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="draft">
                        <div>
                          <div className="font-medium">Draft</div>
                          <div className="text-xs text-gray-500">
                            Product is saved but not visible to customers
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="archived">
                        <div>
                          <div className="font-medium">Archived</div>
                          <div className="text-xs text-gray-500">
                            Product is hidden and cannot be purchased
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    name="isFeatured"
                    checked={formData.isFeatured}
                    onChange={handleCheckboxChange}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isFeatured">
                    Featured (show on homepage)
                  </Label>
                </div>
              </div>
            </Card>
          </div>

          {/* Images */}
          <div className="space-y-6">
            {/* Main Image */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Main Image</h2>
              <div className="space-y-4">
                {mainImagePreview && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={mainImagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleMainImageChange(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <FileUploader
                  handleChange={(file: File | File[]) => {
                    handleMainImageChange(Array.isArray(file) ? file[0] : file);
                  }}
                  name="mainImage"
                  types={fileTypes}
                  maxSize={5}
                  hoverTitle="Drop image here"
                  label="Drag & drop main image here or click to browse"
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Drag & drop image here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      JPG, PNG, GIF, JPEG, WEBP (max 5MB)
                    </p>
                  </div>
                </FileUploader>
              </div>
            </Card>

            {/* Gallery Images */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Gallery Images</h2>
              <div className="space-y-4">
                {/* Existing gallery images */}
                {galleryUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {galleryUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={url}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGalleryUrl(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New gallery images */}
                {galleryPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {galleryPreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <FileUploader
                  handleChange={(files: File | File[]) => {
                    handleGalleryChange(Array.isArray(files) ? files : [files]);
                  }}
                  name="gallery"
                  types={fileTypes}
                  maxSize={5}
                  multiple
                  hoverTitle="Drop images here"
                  label="Drag & drop gallery images here or click to browse"
                >
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Drag & drop images here or click to browse
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      JPG, PNG, GIF, JPEG, WEBP (max 5MB each)
                    </p>
                  </div>
                </FileUploader>
              </div>
            </Card>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link href={`${basePath}/products`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading
              ? "Saving..."
              : mode === "create"
                ? "Create Product"
                : "Update Product"}
          </Button>
        </div>
      </form>

      {/* Documentation Required Dialog */}
      <Dialog
        open={showDocumentationModal}
        onOpenChange={setShowDocumentationModal}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Documentation Required</DialogTitle>
            <DialogDescription>
              This category requires the following documents before you can list
              products:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="list-disc list-inside space-y-1">
              {missingDocuments.map((doc) => (
                <li key={doc.id} className="text-sm text-gray-700">
                  {doc.name}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDocumentationModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Link href="/dashboard/documentation" className="flex-1">
              <Button className="w-full">Upload Documents</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
