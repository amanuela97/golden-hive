"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, FileText } from "lucide-react";
import Link from "next/link";
import { useCreateCategory } from "@/app/hooks/useCategoryQueries";
import { getAllDocumentationTypes } from "@/app/actions/documentation";
import { DocumentationType } from "@/db/schema";
import toast from "react-hot-toast";

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
    requiresDocumentation: false,
    documentationDescription: "",
    documentationTypeIds: [] as string[],
  });

  const [documentationTypes, setDocumentationTypes] = useState<
    DocumentationType[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDocumentationTypes();
  }, []);

  const loadDocumentationTypes = async () => {
    try {
      setLoadingDocs(true);
      const result = await getAllDocumentationTypes();
      if (result.success && result.result) {
        setDocumentationTypes(result.result);
      } else {
        toast.error(result.error || "Failed to load documentation types");
      }
    } catch (error) {
      console.error("Error loading documentation types:", error);
      toast.error("Failed to load documentation types");
    } finally {
      setLoadingDocs(false);
    }
  };

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
        requiresDocumentation: formData.requiresDocumentation,
        documentationDescription:
          formData.documentationDescription.trim() || undefined,
        documentationTypeIds: formData.documentationTypeIds,
      },
      {
        onSuccess: () => {
          router.push("/dashboard/admin/categories");
        },
      }
    );
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleDocumentationTypeToggle = (
    docTypeId: string,
    checked: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      documentationTypeIds: checked
        ? [...prev.documentationTypeIds, docTypeId]
        : prev.documentationTypeIds.filter((id) => id !== docTypeId),
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/categories">
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

          {/* Documentation Requirements Section */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Documentation Requirements
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresDocumentation"
                  checked={formData.requiresDocumentation}
                  onCheckedChange={(checked) =>
                    handleInputChange(
                      "requiresDocumentation",
                      checked as boolean
                    )
                  }
                />
                <Label
                  htmlFor="requiresDocumentation"
                  className="text-sm font-medium"
                >
                  This category requires documentation from sellers
                </Label>
              </div>

              {formData.requiresDocumentation && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div>
                    <Label htmlFor="documentationDescription">
                      Documentation Description
                    </Label>
                    <Textarea
                      id="documentationDescription"
                      value={formData.documentationDescription}
                      onChange={(e) =>
                        handleInputChange(
                          "documentationDescription",
                          e.target.value
                        )
                      }
                      placeholder="Explain what documentation is required and why..."
                      rows={3}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      This description will be shown to sellers when they try to
                      list products in this category
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      Required Documentation Types
                    </Label>
                    <p className="text-sm text-gray-500 mb-3">
                      Select the types of documents that sellers must upload for
                      this category
                    </p>

                    {loadingDocs ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">
                          Loading documentation types...
                        </p>
                      </div>
                    ) : documentationTypes.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          No documentation types available
                        </p>
                        <p className="text-xs text-gray-500">
                          Create documentation types first in the{" "}
                          <Link
                            href="/dashboard/admin/documentation"
                            className="text-blue-600 hover:underline"
                          >
                            Documentation Management
                          </Link>{" "}
                          page
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {documentationTypes.map((docType) => (
                          <div
                            key={docType.id}
                            className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Checkbox
                              id={`doc-type-${docType.id}`}
                              checked={formData.documentationTypeIds.includes(
                                docType.id
                              )}
                              onCheckedChange={(checked) =>
                                handleDocumentationTypeToggle(
                                  docType.id,
                                  checked as boolean
                                )
                              }
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`doc-type-${docType.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {docType.name}
                              </Label>
                              {docType.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {docType.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Link href="/dashboard/admin/categories">
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
