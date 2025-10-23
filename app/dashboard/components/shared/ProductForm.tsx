"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Listing,
  type CreateListingData,
  type UpdateListingData,
} from "@/lib/listing";
import { Upload, X, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { useCategories } from "@/app/hooks/useCategoryQueries";
import { InputTags } from "@/app/components/input-tags";
import { checkSellerDocumentationForCategory } from "@/app/actions/documentation";
import { useSession } from "@/lib/auth-client";

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Partial<Listing>;
  onSubmit: (data: CreateListingData | UpdateListingData) => Promise<void>;
  isLoading?: boolean;
  basePath: string; // e.g., "/dashboard/admin" or "/dashboard/seller"
  isAdmin?: boolean; // Whether the current user is an admin
}

export default function ProductForm({
  mode,
  initialData,
  onSubmit,
  isLoading = false,
  basePath,
  isAdmin = false,
}: ProductFormProps) {
  // Fetch categories using react-query
  const { data: categoriesData, isLoading: categoriesLoading } =
    useCategories();
  const categories = categoriesData?.result || [];

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    category: initialData?.category || "",
    price: initialData?.price ? parseFloat(initialData.price) : 0,
    currency: initialData?.currency || "NPR",
    stockQuantity: initialData?.stockQuantity || 0,
    unit: initialData?.unit || "kg",
    isActive: initialData?.isActive ?? true,
    isFeatured: initialData?.isFeatured ?? false,
    marketType: initialData?.marketType || "local",
    originVillage: initialData?.originVillage || "",
    harvestDate: initialData?.harvestDate
      ? new Date(initialData.harvestDate).toISOString().split("T")[0]
      : "",
    tags: initialData?.tags || [],
  });

  const [tags, setTags] = useState<string[]>(initialData?.tags || []);

  const [mainImage, setMainImage] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    initialData?.gallery || []
  );

  const [showDocumentationModal, setShowDocumentationModal] = useState(false);
  const [missingDocuments, setMissingDocuments] = useState<
    { id: string; name: string }[]
  >([]);

  const mainImageRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
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

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainImage(file);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles((prev) => [...prev, ...files]);

    // Create preview URLs
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviewImages((prev) => [...prev, ...newPreviews]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewImages((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
  };

  const removeGalleryUrl = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    // Check for required documentation if creating a new product and category is selected
    if (mode === "create" && formData.category && session?.user?.id) {
      try {
        const docCheck = await checkSellerDocumentationForCategory(
          session.user.id,
          formData.category
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

    try {
      const baseData = {
        ...formData,
        tags,
        harvestDate: formData.harvestDate
          ? new Date(formData.harvestDate)
          : undefined,
      };

      let submitData: CreateListingData | UpdateListingData;

      if (mode === "create") {
        submitData = {
          ...baseData,
          mainImage,
          galleryFiles: galleryFiles.length > 0 ? galleryFiles : undefined,
          gallery: galleryUrls.length > 0 ? galleryUrls : undefined,
        } as CreateListingData;
      } else {
        if (!initialData?.id) {
          toast.error("Product ID is required for editing");
          return;
        }
        submitData = {
          ...baseData,
          id: initialData.id,
          mainImage,
          galleryFiles: galleryFiles.length > 0 ? galleryFiles : undefined,
          gallery: galleryUrls.length > 0 ? galleryUrls : undefined,
        } as UpdateListingData;
      }

      await onSubmit(submitData);
    } catch (error) {
      toast.error(
        `Failed to ${mode === "create" ? "create" : "update"} product`
      );
      console.error("Submit error:", error);
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
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={categoriesLoading}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {categoriesLoading && (
                    <p className="text-sm text-gray-500 mt-1">
                      Loading categories...
                    </p>
                  )}
                </div>
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
                  <Label htmlFor="stockQuantity">Stock Quantity</Label>
                  <Input
                    id="stockQuantity"
                    name="stockQuantity"
                    type="number"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
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

            {/* Status */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Status & Visibility
              </h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleCheckboxChange}
                    disabled={!isAdmin}
                    className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="isActive"
                    className={!isAdmin ? "text-gray-500" : ""}
                  >
                    Active (visible to customers)
                    {!isAdmin && (
                      <span className="text-xs text-gray-400 ml-1">
                        (Admin only)
                      </span>
                    )}
                  </Label>
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
                {initialData?.imageUrl && !mainImage && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={initialData.imageUrl}
                      alt="Current product image"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                {mainImage && (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={URL.createObjectURL(mainImage)}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <input
                  ref={mainImageRef}
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => mainImageRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {mainImage ? "Change Image" : "Upload Image"}
                </Button>
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
                          <Image
                            src={url}
                            alt={`Gallery ${index + 1}`}
                            fill
                            className="object-cover"
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
                {previewImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {previewImages.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            fill
                            className="object-cover"
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

                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => galleryRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Gallery Images
                </Button>
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

      {/* Documentation Required Modal */}
      {showDocumentationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Documentation Required
            </h3>
            <p className="text-gray-600 mb-4">
              This category requires the following documents before you can list
              products:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              {missingDocuments.map((doc) => (
                <li key={doc.id} className="text-sm text-gray-700">
                  {doc.name}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDocumentationModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Link href="/dashboard/seller/documentation" className="flex-1">
                <Button className="w-full">Upload Documents</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
