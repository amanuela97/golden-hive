"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Save } from "lucide-react";
// Removed client-side cloudinary import - now handled server-side
import {
  CreateHeroSlideData,
  UpdateHeroSlideData,
  HeroSlide,
} from "../../../actions/homepage-content";
import Image from "next/image";

interface HeroFormProps {
  initialData?: HeroSlide | null;
  onSubmit: (data: CreateHeroSlideData | UpdateHeroSlideData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function HeroForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: HeroFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    subtitle: initialData?.subtitle || "",
    ctaLabel: initialData?.ctaLabel || "",
    ctaLink: initialData?.ctaLink || "",
    order: initialData?.order || 0,
    isActive: initialData?.isActive ?? true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.imageUrl || null
  );
  const [previewType, setPreviewType] = useState<"url" | "file">("url");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imageRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    field: string,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({
        ...prev,
        image: "Please select a valid image file",
      }));
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        image: "Image size must be less than 5MB",
      }));
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setPreviewType("file");
    setErrors((prev) => ({ ...prev, image: "" }));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(initialData?.imageUrl || null);
    setPreviewType("url");
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!imageFile && !initialData?.imageUrl) {
      newErrors.image = "Image is required";
    }

    if (formData.title && formData.title.length > 100) {
      newErrors.title = "Title must be less than 100 characters";
    }

    if (formData.subtitle && formData.subtitle.length > 200) {
      newErrors.subtitle = "Subtitle must be less than 200 characters";
    }

    if (formData.ctaLabel && formData.ctaLabel.length > 50) {
      newErrors.ctaLabel = "CTA label must be less than 50 characters";
    }

    if (
      formData.ctaLink &&
      !isValidUrl(formData.ctaLink) &&
      !formData.ctaLink.startsWith("/")
    ) {
      newErrors.ctaLink = "Please enter a valid URL or route (starting with /)";
    }

    if (formData.order < 0) {
      newErrors.order = "Order must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const submitData = {
      ...formData,
      title: formData.title || undefined,
      subtitle: formData.subtitle || undefined,
      ctaLabel: formData.ctaLabel || undefined,
      ctaLink: formData.ctaLink || undefined,
      imageFile: imageFile || undefined,
      imageUrl: initialData?.imageUrl || undefined,
    };

    if (initialData) {
      onSubmit({ ...submitData, id: initialData.id } as UpdateHeroSlideData);
    } else {
      onSubmit(submitData as CreateHeroSlideData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? "Edit Hero Slide" : "Create New Hero Slide"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label htmlFor="image">Hero Image *</Label>
            <div className="space-y-4">
              {imagePreview ? (
                <div className="relative">
                  {previewType === "file" ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg border"
                    />
                  ) : (
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg border"
                      width={500}
                      height={500}
                      quality={100}
                      priority
                    />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-2">
                    Click to upload hero image
                  </p>
                  <p className="text-sm text-gray-400">PNG, JPG up to 5MB</p>
                </div>
              )}
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => imageRef.current?.click()}
                className="w-full"
              >
                {imagePreview ? "Change Image" : "Select Image"}
              </Button>
              {errors.image && (
                <p className="text-sm text-red-500">{errors.image}</p>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter hero title"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Subtitle */}
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Textarea
              id="subtitle"
              value={formData.subtitle}
              onChange={(e) => handleInputChange("subtitle", e.target.value)}
              placeholder="Enter hero subtitle"
              maxLength={200}
              rows={3}
            />
            {errors.subtitle && (
              <p className="text-sm text-red-500">{errors.subtitle}</p>
            )}
          </div>

          {/* CTA Label */}
          <div className="space-y-2">
            <Label htmlFor="ctaLabel">Call-to-Action Label</Label>
            <Input
              id="ctaLabel"
              value={formData.ctaLabel}
              onChange={(e) => handleInputChange("ctaLabel", e.target.value)}
              placeholder="e.g., Shop Now, Learn More"
              maxLength={50}
            />
            {errors.ctaLabel && (
              <p className="text-sm text-red-500">{errors.ctaLabel}</p>
            )}
          </div>

          {/* CTA Link */}
          <div className="space-y-2">
            <Label htmlFor="ctaLink">Call-to-Action Link</Label>
            <Input
              id="ctaLink"
              type="text"
              value={formData.ctaLink}
              onChange={(e) => handleInputChange("ctaLink", e.target.value)}
              placeholder="https://example.com or /products"
            />
            {errors.ctaLink && (
              <p className="text-sm text-red-500">{errors.ctaLink}</p>
            )}
          </div>

          {/* Order */}
          <div className="space-y-2">
            <Label htmlFor="order">Display Order</Label>
            <Input
              id="order"
              type="number"
              value={formData.order}
              onChange={(e) =>
                handleInputChange("order", parseInt(e.target.value) || 0)
              }
              min="0"
              placeholder="0"
            />
            {errors.order && (
              <p className="text-sm text-red-500">{errors.order}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange("isActive", e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isActive">Active (visible on homepage)</Label>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (!imageFile && !initialData?.imageUrl)}
              className="flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>
                {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
