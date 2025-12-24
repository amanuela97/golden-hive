"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, User, Upload, X } from "lucide-react";
import {
  updateUserProfile,
  getUserProfile,
  uploadProfileImage,
} from "../../../../actions/auth";
import toast from "react-hot-toast";
import { CountrySelect } from "@/components/ui/country-select";
import Image from "next/image";
import { FileUploader } from "react-drag-drop-files";

export default function ProfileTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    image: "",
  });

  // Fetch user profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const result = await getUserProfile();
        if (result.success && result.result) {
          const profileData = result.result;

          // Convert country full name to code for CountrySelect component
          // The DB stores full names, but CountrySelect works with codes
          let countryCode = profileData.country ?? "";
          if (countryCode) {
            try {
              const countries = await import("@/data/countries.json").then(
                (m) => m.default
              );
              // Try to find by full name (label) first
              const country = countries.find(
                (c: { label: string; value: string }) => c.label === countryCode
              );
              if (country) {
                countryCode = country.value; // Use code for the component
              }
              // If not found by label, assume it's already a code
            } catch (error) {
              console.error("Error loading countries data:", error);
            }
          }

          // Use nullish coalescing to preserve actual values (including empty strings)
          // Only default to empty string if the value is null or undefined
          const newFormData = {
            name: profileData.name ?? "",
            email: profileData.email ?? "",
            phone: profileData.phone ?? "",
            address: profileData.address ?? "",
            city: profileData.city ?? "",
            // Convert country full name to code for the component
            country: countryCode,
            // Set default image if it exists in DB
            image: profileData.image ?? "",
          };

          setFormData(newFormData);
        } else {
          toast.error(result.error || "Failed to load profile");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = async (file: File | File[]) => {
    // Handle both single file and array (react-drag-drop-files can return either)
    const imageFile = Array.isArray(file) ? file[0] : file;
    if (!imageFile) return;

    // Validate file type
    if (!imageFile.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageFile.size > maxSize) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formDataToUpload = new FormData();
      formDataToUpload.append("image", imageFile);

      const result = await uploadProfileImage(formDataToUpload);

      if (result.success && result.imageUrl) {
        setFormData((prev) => ({ ...prev, image: result.imageUrl! }));
        toast.success("Profile image uploaded successfully");
      } else {
        toast.error(result.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setIsUploadingImage(true);
    try {
      // Convert country code to full name if needed
      let countryValue = formData.country || null;
      if (countryValue) {
        const countries = await import("@/data/countries.json").then(
          (m) => m.default
        );
        const country = countries.find(
          (c: { value: string; label: string }) => c.value === countryValue
        );
        if (country) {
          countryValue = country.label; // Store full name in DB
        }
      }

      const result = await updateUserProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        country: countryValue,
        image: null,
      });

      if (result.success) {
        setFormData((prev) => ({ ...prev, image: "" }));
        toast.success("Profile image removed successfully");
      } else {
        toast.error(result.error || "Failed to remove image");
      }
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error("Failed to remove image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }

    setIsLoading(true);
    try {
      // Convert country code to full name if needed (for backward compatibility)
      // If formData.country is a code, find the full name, otherwise use as-is
      let countryValue = formData.country || null;
      if (countryValue) {
        const countries = await import("@/data/countries.json").then(
          (m) => m.default
        );
        const country = countries.find(
          (c: { value: string; label: string }) => c.value === countryValue
        );
        // If it's already a full name (not found by code), keep it as-is
        // Otherwise, convert code to full name for database storage
        if (country) {
          countryValue = country.label; // Store full name in DB
        }
      }

      const result = await updateUserProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        country: countryValue,
        image: formData.image || null,
      });

      if (result.success) {
        toast.success("Profile updated successfully");
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-8">
        <Card className="p-8">
          <div className="text-center py-8">Loading profile...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Image Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Profile Picture</Label>
            <div className="flex items-start gap-6">
              <div className="relative flex-shrink-0">
                {formData.image && formData.image.trim() !== "" ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border">
                    <Image
                      src={formData.image}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <User className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <FileUploader
                  handleChange={handleImageChange}
                  name="image"
                  types={["JPG", "JPEG", "PNG", "GIF", "WEBP"]}
                  disabled={isUploadingImage}
                  hoverTitle="Drop image here"
                  dropMessageStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "2px dashed hsl(var(--border))",
                    borderRadius: "0.5rem",
                    padding: "1.5rem",
                    textAlign: "center",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">
                      {isUploadingImage
                        ? "Uploading..."
                        : "Drag & drop image here or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, GIF, WEBP (max 5MB)
                    </p>
                  </div>
                </FileUploader>
                {formData.image && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    disabled={isUploadingImage}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove Image
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: Square image, at least 400x400px. Max file size: 5MB
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Full Name *
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address *
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium">
                Country
              </Label>
              <CountrySelect
                id="country"
                value={formData.country}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, country: value }))
                }
                placeholder="Select a country"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">
                City
              </Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Enter your city"
                className="h-11"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address
              </Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter your address"
                className="h-11"
              />
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
