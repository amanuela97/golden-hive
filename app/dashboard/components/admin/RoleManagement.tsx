"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Shield, Plus, Edit, Trash2, Users, Eye } from "lucide-react";
import {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  getRoleWithPermissions,
} from "@/app/actions/admin";
import toast from "react-hot-toast";
interface Role {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  permissions: Permission[];
  createdAt: Date | null;
  updatedAt: Date;
}

interface RoleFromDB {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: Date | null;
  updatedAt: Date;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date | null;
  updatedAt: Date;
}

interface RoleManagementProps {
  initialRoles: RoleFromDB[] | null;
  initialPermissions: Permission[] | null;
}

export default function RoleManagement({
  initialRoles,
  initialPermissions,
}: RoleManagementProps) {
  const [roles, setRoles] = useState<RoleFromDB[]>(initialRoles || []);
  const [permissions, setPermissions] = useState<Permission[]>(
    initialPermissions || []
  );
  const [loading, setLoading] = useState(false); // No loading on initial render

  // Fetch roles and permissions from database only if we don't have initial data
  useEffect(() => {
    // Skip fetch if we have initial data
    if (initialRoles && initialPermissions) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [rolesResult, permissionsResult] = await Promise.all([
          getAllRoles(),
          getAllPermissions(),
        ]);

        if (rolesResult.success && rolesResult.result) {
          setRoles(rolesResult.result as RoleFromDB[]);
        } else {
          toast.error(rolesResult.error || "Failed to fetch roles");
        }

        if (permissionsResult.success && permissionsResult.result) {
          setPermissions(permissionsResult.result as Permission[]);
        } else {
          toast.error(permissionsResult.error || "Failed to fetch permissions");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [initialRoles, initialPermissions]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleCreateRole = async (
    roleData: Omit<Role, "id" | "userCount" | "createdAt" | "updatedAt">
  ) => {
    try {
      const result = await createRole({
        name: roleData.name,
        description: roleData.description || undefined,
        permissions: roleData.permissions.map((p) => p.id),
      });

      if (result.success) {
        toast.success("Role created successfully");
        setIsCreateDialogOpen(false);
        // Refresh roles list
        const rolesResult = await getAllRoles();
        if (rolesResult.success && rolesResult.result) {
          setRoles(rolesResult.result as RoleFromDB[]);
        }
      } else {
        toast.error(result.error || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      toast.error("Failed to create role");
    }
  };

  const handleEditRole = async (roleId: number, roleData: Partial<Role>) => {
    try {
      const result = await updateRole(roleId, {
        name: roleData.name,
        description: roleData.description || undefined,
        permissions: roleData.permissions?.map((p) => p.id) || [],
      });

      if (result.success) {
        toast.success("Role updated successfully");
        setIsEditDialogOpen(false);
        // Refresh roles list
        const rolesResult = await getAllRoles();
        if (rolesResult.success && rolesResult.result) {
          setRoles(rolesResult.result as RoleFromDB[]);
        }
      } else {
        toast.error(result.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this role? Users with this role will need to be reassigned."
      )
    ) {
      return;
    }

    try {
      const result = await deleteRole(roleId);
      if (result.success) {
        toast.success("Role deleted successfully");
        // Refresh roles list
        const rolesResult = await getAllRoles();
        if (rolesResult.success && rolesResult.result) {
          setRoles(rolesResult.result as RoleFromDB[]);
        }
      } else {
        toast.error(result.error || "Failed to delete role");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error("Failed to delete role");
    }
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      const category = permission.category || "Other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  if (loading) {
    return <div className="flex justify-center p-8">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Role & Permission Management</h2>
          <p className="text-gray-600">
            Manage user roles and their permissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <CreateRoleForm
              permissions={permissions}
              onSubmit={handleCreateRole}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">- permissions</span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      {role.userCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {role.createdAt?.toLocaleDateString() || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const result = await getRoleWithPermissions(
                              role.id
                            );
                            if (result.success && result.result) {
                              setSelectedRole(result.result as Role);
                              setIsViewDialogOpen(true);
                            } else {
                              toast.error(
                                result.error || "Failed to fetch role details"
                              );
                            }
                          } catch (error) {
                            console.error(
                              "Error fetching role details:",
                              error
                            );
                            toast.error("Failed to fetch role details");
                          }
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const result = await getRoleWithPermissions(
                              role.id
                            );
                            if (result.success && result.result) {
                              setSelectedRole(result.result as Role);
                              setIsEditDialogOpen(true);
                            } else {
                              toast.error(
                                result.error || "Failed to fetch role details"
                              );
                            }
                          } catch (error) {
                            console.error(
                              "Error fetching role details:",
                              error
                            );
                            toast.error("Failed to fetch role details");
                          }
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRole(role.id)}
                        disabled={role.name === "Admin"} // Prevent deleting admin role
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

      {/* Permission Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(groupedPermissions).map(
          ([category, categoryPermissions]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryPermissions.map((permission) => (
                    <div key={permission.id} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm">{permission.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {permission.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* View Role Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Role Details: {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="text-gray-700">{selectedRole.description}</p>
              </div>
              <div>
                <Label>
                  Permissions ({selectedRole.permissions?.length || 0})
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {selectedRole.permissions?.map((permission) => (
                    <div
                      key={permission.id}
                      className="bg-gray-50 p-2 rounded text-sm"
                    >
                      {permission.name}
                    </div>
                  )) || []}
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Users with this role: {selectedRole.userCount}</span>
                <span>
                  Created:{" "}
                  {selectedRole.createdAt?.toLocaleDateString() || "N/A"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Role: {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          {selectedRole && (
            <EditRoleForm
              role={selectedRole}
              permissions={permissions}
              onSubmit={(data) => handleEditRole(selectedRole.id, data)}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Role Form Component
function CreateRoleForm({
  permissions,
  onSubmit,
  onCancel,
}: {
  permissions: Permission[];
  onSubmit: (
    data: Omit<Role, "id" | "userCount" | "createdAt" | "updatedAt">
  ) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as Permission[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.some((p) => p.id === permission.id)
        ? prev.permissions.filter((p) => p.id !== permission.id)
        : [...prev.permissions, permission],
    }));
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      const category = permission.category || "Other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Role Name</Label>
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
          value={formData.description || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          required
        />
      </div>
      <div>
        <Label>Permissions</Label>
        <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-4">
          {Object.entries(groupedPermissions).map(
            ([category, categoryPermissions]) => (
              <div key={category}>
                <h4 className="font-medium text-sm mb-2">{category}</h4>
                <div className="space-y-2">
                  {categoryPermissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.some(
                          (p) => p.id === permission.id
                        )}
                        onChange={() => togglePermission(permission)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {permission.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {permission.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Role</Button>
      </div>
    </form>
  );
}

// Edit Role Form Component
function EditRoleForm({
  role,
  permissions,
  onSubmit,
  onCancel,
}: {
  role: Role;
  permissions: Permission[];
  onSubmit: (data: Partial<Role>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: role.name,
    description: role.description,
    permissions: role.permissions || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.some((p) => p.id === permission.id)
        ? prev.permissions.filter((p) => p.id !== permission.id)
        : [...prev.permissions, permission],
    }));
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      const category = permission.category || "Other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Role Name</Label>
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
          value={formData.description || ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          required
        />
      </div>
      <div>
        <Label>Permissions</Label>
        <div className="max-h-60 overflow-y-auto border rounded-lg p-4 space-y-4">
          {Object.entries(groupedPermissions).map(
            ([category, categoryPermissions]) => (
              <div key={category}>
                <h4 className="font-medium text-sm mb-2">{category}</h4>
                <div className="space-y-2">
                  {categoryPermissions.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.some(
                          (p) => p.id === permission.id
                        )}
                        onChange={() => togglePermission(permission)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {permission.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {permission.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Update Role</Button>
      </div>
    </form>
  );
}
