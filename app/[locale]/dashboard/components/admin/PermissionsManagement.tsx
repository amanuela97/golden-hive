"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Edit, Trash2 } from "lucide-react";
import {
  usePermissions,
  useCreatePermission,
  useUpdatePermission,
  useDeletePermission,
} from "../../../hooks/useAdminQueries";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date | null;
  updatedAt: Date;
}

interface PermissionsManagementProps {
  initialPermissions: Permission[] | null;
}

export default function PermissionsManagement({
  initialPermissions,
}: PermissionsManagementProps) {
  // Use react-query to fetch permissions
  const { data: permissionsData, isLoading } = usePermissions();

  // React Query mutations
  const createPermissionMutation = useCreatePermission();
  const updatePermissionMutation = useUpdatePermission();
  const deletePermissionMutation = useDeletePermission();

  // Extract data from query
  const permissions = permissionsData?.result || initialPermissions || [];

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);

  const handleCreatePermission = async (
    permissionData: Omit<Permission, "id" | "createdAt" | "updatedAt">
  ) => {
    createPermissionMutation.mutate(
      {
        name: permissionData.name,
        description: permissionData.description || undefined,
        category: permissionData.category || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
        },
      }
    );
  };

  const handleEditPermission = async (
    permissionId: string,
    permissionData: Partial<Permission>
  ) => {
    updatePermissionMutation.mutate(
      {
        permissionId,
        permissionData: {
          name: permissionData.name,
          description: permissionData.description || undefined,
          category: permissionData.category || undefined,
        },
      },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
        },
      }
    );
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this permission? This will remove it from all roles."
      )
    ) {
      return;
    }

    deletePermissionMutation.mutate(permissionId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">Loading permissions...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Permission Management</h2>
          <p className="text-gray-600">
            Manage system permissions and their categories
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Permission
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Permission</DialogTitle>
            </DialogHeader>
            <CreatePermissionForm
              onSubmit={handleCreatePermission}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Permissions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.id}</TableCell>
                  <TableCell>{permission.name}</TableCell>
                  <TableCell>
                    {permission.description || "No description"}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                      {permission.category || "Other"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPermission(permission);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePermission(permission.id)}
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

      {/* Edit Permission Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Permission: {selectedPermission?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPermission && (
            <EditPermissionForm
              permission={selectedPermission}
              onSubmit={(data) =>
                handleEditPermission(selectedPermission.id, data)
              }
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Permission Form Component
function CreatePermissionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Omit<Permission, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Permission Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g., Manage Users"
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
          placeholder="Brief description of the permission"
        />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, category: e.target.value }))
          }
          placeholder="e.g., User Management"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Permission</Button>
      </div>
    </form>
  );
}

// Edit Permission Form Component
function EditPermissionForm({
  permission,
  onSubmit,
  onCancel,
}: {
  permission: Permission;
  onSubmit: (data: Partial<Permission>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: permission.name,
    description: permission.description || "",
    category: permission.category || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="id">Permission ID</Label>
        <Input id="id" value={permission.id} disabled className="bg-gray-50" />
      </div>
      <div>
        <Label htmlFor="name">Permission Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
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
        />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, category: e.target.value }))
          }
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Update Permission</Button>
      </div>
    </form>
  );
}
