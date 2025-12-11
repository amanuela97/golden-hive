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
  useCategoryRules,
  useCreateCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
} from "../../../hooks/useCategoryRuleQueries";
import { getCategoryRuleWithDocumentation } from "../../../actions/category-rules";
import { getAllDocumentationTypes } from "../../../actions/documentation";
import { DocumentationType } from "@/db/schema";
import { TaxonomyCategorySelector } from "../shared/TaxonomyCategorySelector";
import { findCategoryById } from "@/lib/taxonomy";
import toast from "react-hot-toast";

interface CategoryRule {
  id: string;
  taxonomyCategoryId: string;
  requiresDocumentation: boolean;
  documentationDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  taxonomyCategoryName?: string;
}

interface CategoryManagementProps {
  initialCategoryRules: CategoryRule[] | null;
}

export default function CategoryManagement({
  initialCategoryRules,
}: CategoryManagementProps) {
  // Use react-query to fetch category rules
  const { data: rulesData, isLoading } = useCategoryRules();

  // React Query mutations
  const createRuleMutation = useCreateCategoryRule();
  const updateRuleMutation = useUpdateCategoryRule();
  const deleteRuleMutation = useDeleteCategoryRule();

  // Extract data from query
  const categoryRules = rulesData?.result || initialCategoryRules || [];

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CategoryRule | null>(null);
  const [documentationTypes, setDocumentationTypes] = useState<
    DocumentationType[]
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [editFormData, setEditFormData] = useState({
    taxonomyCategoryId: "",
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

  const handleCreateRule = async (ruleData: {
    taxonomyCategoryId: string;
    requiresDocumentation?: boolean;
    documentationDescription?: string;
    documentationTypeIds?: string[];
  }) => {
    createRuleMutation.mutate(
      {
        taxonomyCategoryId: ruleData.taxonomyCategoryId,
        requiresDocumentation: ruleData.requiresDocumentation || false,
        documentationDescription:
          ruleData.documentationDescription || undefined,
        documentationTypeIds: ruleData.documentationTypeIds || [],
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
        },
      }
    );
  };

  const handleEditRule = async (
    ruleId: string,
    ruleData: {
      requiresDocumentation?: boolean;
      documentationDescription?: string;
    }
  ) => {
    updateRuleMutation.mutate(
      {
        ruleId,
        ruleData: {
          requiresDocumentation: ruleData.requiresDocumentation,
          documentationDescription:
            ruleData.documentationDescription || undefined,
          documentationTypeIds: editFormData.documentationTypeIds,
        },
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditFormData({
            taxonomyCategoryId: "",
            requiresDocumentation: false,
            documentationDescription: "",
            documentationTypeIds: [],
          });
        },
      }
    );
  };

  const openEditDialog = async (rule: CategoryRule) => {
    try {
      setSelectedRule(rule);

      // Load rule with documentation types
      const result = await getCategoryRuleWithDocumentation(rule.id);
      if (result.success && result.result) {
        setEditFormData({
          taxonomyCategoryId: result.result.taxonomyCategoryId,
          requiresDocumentation: result.result.requiresDocumentation || false,
          documentationDescription:
            result.result.documentationDescription || "",
          documentationTypeIds: result.result.documentationTypes.map(
            (dt) => dt.documentationTypeId
          ),
        });
      } else {
        // Fallback to basic rule data
        setEditFormData({
          taxonomyCategoryId: rule.taxonomyCategoryId,
          requiresDocumentation: rule.requiresDocumentation || false,
          documentationDescription: rule.documentationDescription || "",
          documentationTypeIds: [],
        });
      }

      setIsEditDialogOpen(true);
    } catch (error) {
      console.error("Error loading category rule data:", error);
      toast.error("Failed to load category rule data");
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

  const handleDeleteRule = async (ruleId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this category rule? This will remove documentation requirements for this taxonomy category."
      )
    ) {
      return;
    }

    deleteRuleMutation.mutate(ruleId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">Loading category rules...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Category Rules Management</h2>
          <p className="text-gray-600">
            Set documentation requirements for taxonomy categories
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Category Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Category Rule</DialogTitle>
            </DialogHeader>
            <CreateCategoryRuleForm
              onSubmit={handleCreateRule}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Rules Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taxonomy Category</TableHead>
                <TableHead>Requires Documentation</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryRules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-gray-500"
                  >
                    No category rules found. Create a rule to set documentation
                    requirements for a taxonomy category.
                  </TableCell>
                </TableRow>
              ) : (
                categoryRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-600" />
                        {rule.taxonomyCategoryName || rule.taxonomyCategoryId}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.requiresDocumentation ? (
                        <span className="text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.documentationDescription || "No description"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Category Rule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Category Rule:{" "}
              {selectedRule?.taxonomyCategoryName ||
                selectedRule?.taxonomyCategoryId}
            </DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditRule(selectedRule.id, {
                  requiresDocumentation: editFormData.requiresDocumentation,
                  documentationDescription:
                    editFormData.documentationDescription,
                });
              }}
              className="space-y-6"
            >
              <div>
                <Label htmlFor="edit-taxonomyCategoryId">
                  Taxonomy Category
                </Label>
                <Input
                  id="edit-taxonomyCategoryId"
                  value={editFormData.taxonomyCategoryId}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Taxonomy category cannot be changed. Delete and create a new
                  rule if needed.
                </p>
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
                <Button type="submit" disabled={updateRuleMutation.isPending}>
                  {updateRuleMutation.isPending
                    ? "Updating..."
                    : "Update Category Rule"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Category Rule Form Component
function CreateCategoryRuleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    taxonomyCategoryId: string;
    requiresDocumentation?: boolean;
    documentationDescription?: string;
    documentationTypeIds?: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    taxonomyCategoryId: "",
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
      }
    } catch (error) {
      console.error("Error loading documentation types:", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    if (!formData.taxonomyCategoryId) {
      newErrors.taxonomyCategoryId = "Taxonomy category is required";
    }
    if (!formData.documentationDescription || !formData.documentationDescription.trim()) {
      newErrors.documentationDescription = "Documentation description is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <TaxonomyCategorySelector
        value={formData.taxonomyCategoryId}
        onChange={(value) => {
          // Auto-populate description from taxonomy if available
          const category = findCategoryById(value);
          const categoryDescription = category?.description || "";
          
          setFormData((prev) => ({
            ...prev,
            taxonomyCategoryId: value,
            // Auto-populate description from taxonomy if available, otherwise keep existing or empty
            documentationDescription: categoryDescription || prev.documentationDescription || "",
          }));
          if (errors.taxonomyCategoryId) {
            setErrors((prev) => ({ ...prev, taxonomyCategoryId: "" }));
          }
        }}
        label="Taxonomy Category"
        required
        error={errors.taxonomyCategoryId}
        description="Type to search and select a category from the taxonomy"
      />

      {/* Documentation Requirements Section */}
      <div className="border-t pt-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Documentation Requirements
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="documentationDescription">
              Documentation Description{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="documentationDescription"
              value={formData.documentationDescription}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  documentationDescription: e.target.value,
                }));
                if (errors.documentationDescription) {
                  setErrors((prev) => ({ ...prev, documentationDescription: "" }));
                }
              }}
              placeholder="Explain what documentation is required and why..."
              rows={4}
              className={
                errors.documentationDescription ? "border-red-500" : ""
              }
              required
            />
            {errors.documentationDescription && (
              <p className="text-sm text-red-500 mt-1">
                {errors.documentationDescription}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              This description will be shown to sellers when they try to list
              products in this taxonomy category. If the selected category has a
              description in the taxonomy, it has been pre-filled.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="requiresDocumentation"
              checked={formData.requiresDocumentation}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  requiresDocumentation: checked as boolean,
                }))
              }
            />
            <Label
              htmlFor="requiresDocumentation"
              className="text-sm font-medium"
            >
              This taxonomy category requires documentation from sellers
            </Label>
          </div>

          {formData.requiresDocumentation && (
            <div className="space-y-4 pl-6 border-l-2 border-blue-200">

              <div>
                <Label className="text-sm font-medium">
                  Required Documentation Types
                </Label>
                <p className="text-sm text-gray-500 mb-3">
                  Select the types of documents that sellers must upload for
                  this taxonomy category
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
                        href="/dashboard/settings/documentation"
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

      <div className="flex justify-end gap-2 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Category Rule</Button>
      </div>
    </form>
  );
}
