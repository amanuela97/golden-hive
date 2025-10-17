"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useCreateCategory } from "@/app/hooks/useCategoryQueries";

interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NewCategoryFormProps {
  initialCategories: Category[] | null;
}

export default function NewCategoryForm({
  initialCategories,
}: NewCategoryFormProps) {
  const router = useRouter();
  const createCategoryMutation = useCreateCategory();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    } else if (
      initialCategories?.some(
        (cat) => cat.name.toLowerCase() === formData.name.toLowerCase()
      )
    ) {
      newErrors.name = "A category with this name already exists";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    createCategoryMutation.mutate(
      {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.push("/dashboard/categories");
        },
      }
    );
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/categories">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Categories
            </Button>
          </Link>
          <div>
            <CardTitle>Category Details</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Fill in the details for your new category
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="name">
                Category Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Mad Honey, Organic Honey, Wild Honey"
                className={errors.name ? "border-red-500" : ""}
                required
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Describe what this category represents..."
                rows={4}
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional: Provide a detailed description of this category
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Link href="/dashboard/categories">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={createCategoryMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createCategoryMutation.isPending
                ? "Creating..."
                : "Create Category"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
