"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { ICON_MAP, IconName } from "@/lib/icons";
import {
  CreateBenefitsData,
  UpdateBenefitsData,
  BenefitsSection,
  BenefitItem,
} from "../../../actions/homepage-content";

interface BenefitFormProps {
  initialData?: BenefitsSection | null;
  onSubmit: (data: CreateBenefitsData | UpdateBenefitsData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BenefitForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: BenefitFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "Why Choose Golden Hive?",
    isActive: initialData?.isActive ?? true,
  });

  const [benefitItems, setBenefitItems] = useState<BenefitItem[]>(
    initialData?.items || [
      { icon: "Leaf", title: "", description: "" },
      { icon: "Truck", title: "", description: "" },
      { icon: "ShieldCheck", title: "", description: "" },
    ]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleBenefitChange = (
    index: number,
    field: keyof BenefitItem,
    value: string
  ) => {
    setBenefitItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );

    // Clear error for this benefit item
    const errorKey = `benefit_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }
  };

  const addBenefitItem = () => {
    if (benefitItems.length < 3) {
      setBenefitItems((prev) => [
        ...prev,
        { icon: "Leaf", title: "", description: "" },
      ]);
    }
  };

  const removeBenefitItem = (index: number) => {
    if (benefitItems.length > 1) {
      setBenefitItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (formData.title.length > 100) {
      newErrors.title = "Title must be less than 100 characters";
    }

    // Validate benefit items
    benefitItems.forEach((item, index) => {
      if (!item.title.trim()) {
        newErrors[`benefit_${index}_title`] = "Benefit title is required";
      }
      if (item.title.length > 50) {
        newErrors[`benefit_${index}_title`] =
          "Benefit title must be less than 50 characters";
      }
      if (!item.description.trim()) {
        newErrors[`benefit_${index}_description`] =
          "Benefit description is required";
      }
      if (item.description.length > 200) {
        newErrors[`benefit_${index}_description`] =
          "Benefit description must be less than 200 characters";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const submitData = {
      ...formData,
      items: benefitItems,
    };

    if (initialData) {
      onSubmit({ ...submitData, id: initialData.id } as UpdateBenefitsData);
    } else {
      onSubmit(submitData as CreateBenefitsData);
    }
  };

  const availableIcons = Object.keys(ICON_MAP) as IconName[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? "Edit Benefits Section" : "Create Benefits Section"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Section Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Why Choose Golden Hive?"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Benefit Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Benefit Items * (Max 3)</Label>
              {benefitItems.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBenefitItem}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Benefit</span>
                </Button>
              )}
            </div>

            {benefitItems.map((item, index) => {
              const IconComponent = ICON_MAP[item.icon as IconName];

              return (
                <Card key={index} className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="font-medium">Benefit {index + 1}</h4>
                    {benefitItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBenefitItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Icon Selection */}
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select
                        value={item.icon}
                        onValueChange={(value) =>
                          handleBenefitChange(index, "icon", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an icon">
                            <div className="flex items-center space-x-2">
                              {IconComponent && (
                                <IconComponent className="w-4 h-4" />
                              )}
                              <span>{item.icon}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableIcons.map((iconName) => {
                            const Icon = ICON_MAP[iconName];
                            return (
                              <SelectItem key={iconName} value={iconName}>
                                <div className="flex items-center space-x-2">
                                  <Icon className="w-4 h-4" />
                                  <span>{iconName}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          handleBenefitChange(index, "title", e.target.value)
                        }
                        placeholder="e.g., 100% Natural"
                        maxLength={50}
                      />
                      {errors[`benefit_${index}_title`] && (
                        <p className="text-sm text-red-500">
                          {errors[`benefit_${index}_title`]}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) =>
                          handleBenefitChange(
                            index,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="e.g., Our honey is sourced directly from the Himalayas..."
                        maxLength={200}
                        rows={3}
                      />
                      {errors[`benefit_${index}_description`] && (
                        <p className="text-sm text-red-500">
                          {errors[`benefit_${index}_description`]}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
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
