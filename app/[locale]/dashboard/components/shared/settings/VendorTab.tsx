"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Save, Store, Image as ImageIcon, X } from "lucide-react";
import { upsertVendor, getVendor } from "../../../../actions/vendor";
import toast from "react-hot-toast";
import { FileUploader } from "react-drag-drop-files";

const fileTypes = ["JPG", "PNG", "GIF", "JPEG", "WEBP"];

export default function VendorTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    storeName: "",
    description: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadVendorData();
  }, []);

  const loadVendorData = async () => {
    setLoadingData(true);
    try {
      const result = await getVendor();
      if (result.success && result.result) {
        setFormData({
          storeName: result.result.storeName || "",
          description: result.result.description || "",
        });
        if (result.result.logoUrl) {
          setExistingLogoUrl(result.result.logoUrl);
          setLogoPreview(result.result.logoUrl);
        }
      }
    } catch (error) {
      console.error("Error loading vendor data:", error);
    } finally {
      setLoadingData(false);
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
      const result = await upsertVendor(
        {
          storeName: formData.storeName.trim(),
          description: formData.description.trim() || null,
          logoUrl: existingLogoUrl,
        },
        logoFile || undefined
      );

      if (result.success) {
        toast.success(result.message || "Vendor updated successfully");
        // Update existing logo URL if a new one was uploaded
        if (logoFile && logoPreview && !logoPreview.startsWith("blob:")) {
          // The logo URL will be returned from the server, but for now we'll reload
          await loadVendorData();
        }
      } else {
        toast.error(result.error || "Failed to update vendor");
      }
    } catch (error) {
      console.error("Vendor update error:", error);
      toast.error("Failed to update vendor");
    } finally {
      setIsLoading(false);
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
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-semibold">Vendor Information</h3>
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
              <div className="space-y-4">
                {logoPreview && (
                  <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                    <img
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
    </div>
  );
}
