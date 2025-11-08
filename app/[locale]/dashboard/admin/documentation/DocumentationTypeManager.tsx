"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, FileText, ExternalLink, Save } from "lucide-react";
import {
  getAllDocumentationTypes,
  createDocumentationType,
  updateDocumentationType,
  deleteDocumentationType,
} from "../../../actions/documentation";
import { DocumentationType } from "@/db/schema";
import toast from "react-hot-toast";

export default function DocumentationTypeManager() {
  const [documentationTypes, setDocumentationTypes] = useState<
    DocumentationType[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocumentationType | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    exampleUrl: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDocumentationTypes();
  }, []);

  const loadDocumentationTypes = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.exampleUrl && !isValidUrl(formData.exampleUrl)) {
      newErrors.exampleUrl = "Please enter a valid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      exampleUrl: "",
    });
    setErrors({});
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      const result = await createDocumentationType({
        name: formData.name,
        description: formData.description || undefined,
        exampleUrl: formData.exampleUrl || undefined,
      });

      if (result.success) {
        toast.success("Documentation type created successfully");
        setIsCreateDialogOpen(false);
        resetForm();
        loadDocumentationTypes();
      } else {
        toast.error(result.error || "Failed to create documentation type");
      }
    } catch (error) {
      console.error("Error creating documentation type:", error);
      toast.error("Failed to create documentation type");
    }
  };

  const handleEdit = async () => {
    if (!editingType || !validateForm()) return;

    try {
      const result = await updateDocumentationType(editingType.id, {
        name: formData.name,
        description: formData.description || undefined,
        exampleUrl: formData.exampleUrl || undefined,
      });

      if (result.success) {
        toast.success("Documentation type updated successfully");
        setIsEditDialogOpen(false);
        setEditingType(null);
        resetForm();
        loadDocumentationTypes();
      } else {
        toast.error(result.error || "Failed to update documentation type");
      }
    } catch (error) {
      console.error("Error updating documentation type:", error);
      toast.error("Failed to update documentation type");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const result = await deleteDocumentationType(id);

      if (result.success) {
        toast.success("Documentation type deleted successfully");
        loadDocumentationTypes();
      } else {
        toast.error(result.error || "Failed to delete documentation type");
      }
    } catch (error) {
      console.error("Error deleting documentation type:", error);
      toast.error("Failed to delete documentation type");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditDialog = (type: DocumentationType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || "",
      exampleUrl: type.exampleUrl || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading documentation types...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Documentation Types
          </h2>
          <p className="text-gray-600">
            Manage the types of documents that sellers can upload
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Documentation Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Documentation Type</DialogTitle>
              <DialogDescription>
                Add a new type of document that sellers can upload.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Food Safety License"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Describe what this document is for..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exampleUrl">Example URL</Label>
                <Input
                  id="exampleUrl"
                  value={formData.exampleUrl}
                  onChange={(e) =>
                    handleInputChange("exampleUrl", e.target.value)
                  }
                  placeholder="https://example.com/sample-document.pdf"
                />
                {errors.exampleUrl && (
                  <p className="text-sm text-red-600">{errors.exampleUrl}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                <Save className="w-4 h-4 mr-2" />
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentation Types ({documentationTypes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentationTypes.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No documentation types
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first documentation type to get started.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Documentation Type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentationTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      {type.description ? (
                        <p className="text-sm text-gray-600 max-w-xs truncate">
                          {type.description}
                        </p>
                      ) : (
                        <span className="text-gray-400">No description</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {type.exampleUrl ? (
                        <a
                          href={type.exampleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Example
                        </a>
                      ) : (
                        <span className="text-gray-400">No example</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(type.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(type)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(type.id)}
                          disabled={deletingId === type.id}
                        >
                          {deletingId === type.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Documentation Type</DialogTitle>
            <DialogDescription>
              Update the documentation type information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Food Safety License"
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Describe what this document is for..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-exampleUrl">Example URL</Label>
              <Input
                id="edit-exampleUrl"
                value={formData.exampleUrl}
                onChange={(e) =>
                  handleInputChange("exampleUrl", e.target.value)
                }
                placeholder="https://example.com/sample-document.pdf"
              />
              {errors.exampleUrl && (
                <p className="text-sm text-red-600">{errors.exampleUrl}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingType(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              <Save className="w-4 h-4 mr-2" />
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
