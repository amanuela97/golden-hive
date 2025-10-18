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
  CreateAboutData,
  UpdateAboutData,
  AboutSection,
} from "@/app/actions/homepage-content";
import Image from "next/image";

interface AboutFormProps {
  initialData?: AboutSection | null;
  onSubmit: (data: CreateAboutData | UpdateAboutData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AboutForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: AboutFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "Our Story",
    content: initialData?.content || "",
    isActive: initialData?.isActive ?? true,
  });

  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetPreview, setAssetPreview] = useState<string | null>(
    initialData?.assetUrl || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const assetRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleAssetUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (image or video)
    const validTypes = ["image/", "video/"];
    if (!validTypes.some((type) => file.type.startsWith(type))) {
      setErrors((prev) => ({
        ...prev,
        asset: "Please select a valid image or video file",
      }));
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        asset: "File size must be less than 10MB",
      }));
      return;
    }

    setAssetFile(file);
    setAssetPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, asset: "" }));
  };

  const removeAsset = () => {
    setAssetFile(null);
    setAssetPreview(initialData?.assetUrl || null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (formData.title.length > 100) {
      newErrors.title = "Title must be less than 100 characters";
    }

    if (!formData.content.trim()) {
      newErrors.content = "Content is required";
    }

    if (formData.content.length > 2000) {
      newErrors.content = "Content must be less than 2000 characters";
    }

    // Asset validation removed - handled by file upload

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const submitData = {
      ...formData,
      title: formData.title || "Our Story",
      content: formData.content || undefined,
      assetFile: assetFile || undefined,
      assetUrl: initialData?.assetUrl || undefined,
    };

    if (initialData) {
      onSubmit({ ...submitData, id: initialData.id } as UpdateAboutData);
    } else {
      onSubmit(submitData as CreateAboutData);
    }
  };

  const isVideo =
    assetPreview &&
    (assetPreview.includes(".mp4") ||
      assetPreview.includes(".webm") ||
      assetPreview.includes(".ogg"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? "Edit About Section" : "Create About Section"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Section Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Our Story"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleInputChange("content", e.target.value)}
              placeholder="Tell your story... Share what makes Golden Hive special, your mission, values, and what customers can expect from your products."
              maxLength={2000}
              rows={8}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formData.content.length}/2000 characters</span>
              {errors.content && (
                <span className="text-red-500">{errors.content}</span>
              )}
            </div>
          </div>

          {/* Asset Upload (Image or Video) */}
          <div className="space-y-2">
            <Label htmlFor="asset">Media Asset (Image or Video)</Label>
            <div className="space-y-4">
              {assetPreview ? (
                <div className="relative">
                  {isVideo ? (
                    <video
                      src={assetPreview}
                      controls
                      className="w-full h-64 object-cover rounded-lg border"
                    />
                  ) : (
                    <Image
                      src={assetPreview}
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
                    onClick={removeAsset}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-2">
                    Click to upload image or video
                  </p>
                  <p className="text-sm text-gray-400">
                    PNG, JPG, MP4, WebM up to 10MB
                  </p>
                </div>
              )}
              <input
                ref={assetRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleAssetUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => assetRef.current?.click()}
                className="w-full"
              >
                {assetPreview ? "Change Media" : "Select Media"}
              </Button>
              {errors.asset && (
                <p className="text-sm text-red-500">{errors.asset}</p>
              )}
            </div>
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
              disabled={isLoading}
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
