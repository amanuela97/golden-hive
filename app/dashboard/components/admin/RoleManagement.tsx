"use client";

import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Settings,
  Eye,
  BarChart3,
} from "lucide-react";
import toast from "react-hot-toast";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([
    {
      id: "1",
      name: "Admin",
      description: "Full system access and user management",
      permissions: [
        "manage_users",
        "manage_products",
        "view_analytics",
        "manage_roles",
      ],
      userCount: 2,
      createdAt: "2024-01-01",
    },
    {
      id: "2",
      name: "Seller",
      description: "Can manage their own products and view basic analytics",
      permissions: ["manage_own_products", "view_basic_analytics"],
      userCount: 15,
      createdAt: "2024-01-01",
    },
    {
      id: "3",
      name: "Customer",
      description: "Can browse and purchase products",
      permissions: ["browse_products", "make_purchases"],
      userCount: 150,
      createdAt: "2024-01-01",
    },
  ]);

  const [permissions] = useState<Permission[]>([
    {
      id: "manage_users",
      name: "Manage Users",
      description: "Create, edit, and delete user accounts",
      category: "User Management",
    },
    {
      id: "manage_products",
      name: "Manage All Products",
      description: "Create, edit, and delete any product",
      category: "Product Management",
    },
    {
      id: "manage_own_products",
      name: "Manage Own Products",
      description: "Create, edit, and delete own products",
      category: "Product Management",
    },
    {
      id: "view_analytics",
      name: "View Analytics",
      description: "Access to detailed system analytics",
      category: "Analytics",
    },
    {
      id: "view_basic_analytics",
      name: "View Basic Analytics",
      description: "Access to basic analytics for own data",
      category: "Analytics",
    },
    {
      id: "manage_roles",
      name: "Manage Roles",
      description: "Create, edit, and assign user roles",
      category: "Role Management",
    },
    {
      id: "browse_products",
      name: "Browse Products",
      description: "View and search products",
      category: "Product Access",
    },
    {
      id: "make_purchases",
      name: "Make Purchases",
      description: "Purchase products and manage orders",
      category: "Commerce",
    },
    {
      id: "send_announcements",
      name: "Send Announcements",
      description: "Send system-wide announcements",
      category: "Communication",
    },
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleCreateRole = async (
    roleData: Omit<Role, "id" | "userCount" | "createdAt">
  ) => {
    try {
      const newRole: Role = {
        id: Date.now().toString(),
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        userCount: 0,
        createdAt: new Date().toISOString().split("T")[0],
      };

      setRoles((prev) => [...prev, newRole]);
      toast.success("Role created successfully");
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error("Failed to create role");
    }
  };

  const handleEditRole = async (roleId: string, roleData: Partial<Role>) => {
    try {
      setRoles((prev) =>
        prev.map((role) =>
          role.id === roleId ? { ...role, ...roleData } : role
        )
      );
      toast.success("Role updated successfully");
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this role? Users with this role will need to be reassigned."
      )
    ) {
      return;
    }

    try {
      setRoles((prev) => prev.filter((role) => role.id !== roleId));
      toast.success("Role deleted successfully");
    } catch (error) {
      toast.error("Failed to delete role");
    }
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

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
                    <span className="text-sm text-gray-600">
                      {role.permissions.length} permissions
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      {role.userCount}
                    </span>
                  </TableCell>
                  <TableCell>{role.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role);
                          setIsEditDialogOpen(true);
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
                <Label>Permissions ({selectedRole.permissions.length})</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {selectedRole.permissions.map((permissionId) => {
                    const permission = permissions.find(
                      (p) => p.id === permissionId
                    );
                    return (
                      <div
                        key={permissionId}
                        className="bg-gray-50 p-2 rounded text-sm"
                      >
                        {permission?.name || permissionId}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Users with this role: {selectedRole.userCount}</span>
                <span>Created: {selectedRole.createdAt}</span>
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
  onSubmit: (data: Omit<Role, "id" | "userCount" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
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
          value={formData.description}
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
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
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
    permissions: role.permissions,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const groupedPermissions = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
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
          value={formData.description}
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
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
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
