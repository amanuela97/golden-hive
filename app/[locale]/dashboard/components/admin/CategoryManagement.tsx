"use client";

import React, { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag, FileText } from "lucide-react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../../../hooks/useCategoryQueries";
import { getCategoryWithDocumentation } from "../../../actions/categories";
import { getAllDocumentationTypes } from "../../../actions/documentation";
import { DocumentationType } from "@/db/schema";
import toast from "react-hot-toast";

interface Category {
  id: string;
  name: string;
  description: string | null;
  requiresDocumentation?: boolean;
  documentationDescription?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryManagementProps {
  initialCategories: Category[] | null;
}

export default function CategoryManagement({
  initialCategories,
}: CategoryManagementProps) {
  // Use react-query to fetch categories
  const { data: categoriesData, isLoading } = useCategories();

  // React Query mutations
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Extract data from query
  const categories = categoriesData?.result || initialCategories || [];

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [documentationTypes, setDocumentationTypes] = useState<
    DocumentationType[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    requiresDocumentation: false,
    documentationDescription: "",
    documentationTypeIds: [] as string[],
  });

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

  const handleCreateCategory = async (
    categoryData: Omit<Category, "id" | "createdAt" | "updatedAt">
  ) => {
    createCategoryMutation.mutate(
      {
        name: categoryData.name,
        description: categoryData.description || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
        },
      }
    );
  };

  const handleEditCategory = async (
    categoryId: string,
    categoryData: {
      name?: string;
      description?: string;
      requiresDocumentation?: boolean;
      documentationDescription?: string;
    }
  ) => {
    updateCategoryMutation.mutate(
      {
        categoryId,
        categoryData: {
          name: categoryData.name,
          description: categoryData.description || undefined,
          requiresDocumentation: categoryData.requiresDocumentation,
          documentationDescription:
            categoryData.documentationDescription || undefined,
          documentationTypeIds: editFormData.documentationTypeIds,
        },
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditFormData({
            name: "",
            description: "",
            requiresDocumentation: false,
            documentationDescription: "",
            documentationTypeIds: [],
          });
        },
      }
    );
  };

  const openEditDialog = async (category: Category) => {
    try {
      setSelectedCategory(category);

      // Load category with documentation types
      const result = await getCategoryWithDocumentation(category.id);
      if (result.success && result.result) {
        setEditFormData({
          name: result.result.name,
          description: result.result.description || "",
          requiresDocumentation: result.result.requiresDocumentation || false,
          documentationDescription:
            result.result.documentationDescription || "",
          documentationTypeIds: result.result.documentationTypes.map(
            (dt) => dt.documentationTypeId
          ),
        });
      } else {
        // Fallback to basic category data
        setEditFormData({
          name: category.name,
          description: category.description || "",
          requiresDocumentation: false,
          documentationDescription: "",
          documentationTypeIds: [],
        });
      }

      setIsEditDialogOpen(true);
    } catch (error) {
      console.error("Error loading category data:", error);
      toast.error("Failed to load category data");
    }
  };

  const handleDocumentationTypeToggle = (
    docTypeId: string,
    checked: boolean
  ) => {
    setEditFormData((prev) => ({
      ...prev,
      documentationTypeIds: checked
        ? [...prev.documentationTypeIds, docTypeId]
        : prev.documentationTypeIds.filter((id) => id !== docTypeId),
    }));
  };

  const handleEditInputChange = (field: string, value: string | boolean) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? This will remove it from all products."
      )
    ) {
      return;
    }

    deleteCategoryMutation.mutate(categoryId);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading categories...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Category Management</h2>
          <p className="text-gray-600">
            Manage product categories and their descriptions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
            </DialogHeader>
            <CreateCategoryForm
              onSubmit={handleCreateCategory}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-600" />
                      {category.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.description || "No description"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(category.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Category: {selectedCategory?.name}</DialogTitle>
          </DialogHeader>
          {selectedCategory && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditCategory(selectedCategory.id, {
                  name: editFormData.name,
                  description: editFormData.description,
                  requiresDocumentation: editFormData.requiresDocumentation,
                  documentationDescription:
                    editFormData.documentationDescription,
                });
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Category Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) =>
                      handleEditInputChange("name", e.target.value)
                    }
                    placeholder="e.g., Mad Honey"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editFormData.description}
                    onChange={(e) =>
                      handleEditInputChange("description", e.target.value)
                    }
                    placeholder="Describe this category..."
                  />
                </div>
              </div>

              {/* Documentation Requirements Section */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Documentation Requirements
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-requiresDocumentation"
                      checked={editFormData.requiresDocumentation}
                      onCheckedChange={(checked) =>
                        handleEditInputChange(
                          "requiresDocumentation",
                          checked as boolean
                        )
                      }
                    />
                    <Label
                      htmlFor="edit-requiresDocumentation"
                      className="text-sm font-medium"
                    >
                      This category requires documentation from sellers
                    </Label>
                  </div>

                  {editFormData.requiresDocumentation && (
                    <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                      <div>
                        <Label htmlFor="edit-documentationDescription">
                          Documentation Description
                        </Label>
                        <Textarea
                          id="edit-documentationDescription"
                          value={editFormData.documentationDescription}
                          onChange={(e) =>
                            handleEditInputChange(
                              "documentationDescription",
                              e.target.value
                            )
                          }
                          placeholder="Explain what documentation is required and why..."
                          rows={3}
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          This description will be shown to sellers when they
                          try to list products in this category
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          Required Documentation Types
                        </Label>
                        <p className="text-sm text-gray-500 mb-3">
                          Select the types of documents that sellers must upload
                          for this category
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
                                  id={`edit-doc-type-${docType.id}`}
                                  checked={editFormData.documentationTypeIds.includes(
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
                                    htmlFor={`edit-doc-type-${docType.id}`}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending
                    ? "Updating..."
                    : "Update Category"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Category Form Component
function CreateCategoryForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Omit<Category, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Category Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g., Mad Honey"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Brief description of the category"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Category</Button>
      </div>
    </form>
  );
}
