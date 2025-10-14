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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, Edit, Ban, Trash2, Key } from "lucide-react";
import {
  getAllUsers,
  updateUser,
  suspendUser,
  deleteUser,
  sendPasswordResetToUser,
} from "@/app/actions/admin";
import toast from "react-hot-toast";

interface UserWithStats {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  status: "active" | "suspended" | "pending";
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  roleName: string | null;
  roleId: number | null;
  listingsCount: number;
  isAdmin: boolean;
}

interface UserManagementProps {
  initialData: {
    users: UserWithStats[];
    totalPages: number;
    totalCount: number;
  } | null;
}

export default function UserManagement({ initialData }: UserManagementProps) {
  const [, setUsers] = useState<UserWithStats[]>(initialData?.users || []);
  const [filteredUsers, setFilteredUsers] = useState<UserWithStats[]>(
    initialData?.users || []
  );
  const [loading, setLoading] = useState(false); // No loading on initial render
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(initialData?.totalPages || 1);
  const [totalCount, setTotalCount] = useState(initialData?.totalCount || 0);

  // Fetch users from database when filters change (not on initial load)
  useEffect(() => {
    // Skip initial fetch if we have initial data and no filters are applied
    if (
      initialData &&
      searchTerm === "" &&
      roleFilter === "all" &&
      statusFilter === "all" &&
      currentPage === 1
    ) {
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const result = await getAllUsers(
          currentPage,
          itemsPerPage,
          searchTerm || undefined,
          roleFilter !== "all" ? roleFilter : undefined,
          statusFilter !== "all" ? statusFilter : undefined
        );

        if (result.success && result.result) {
          const data = result.result as {
            users: UserWithStats[];
            totalPages: number;
            totalCount: number;
          };
          setUsers(data.users);
          setFilteredUsers(data.users);
          setTotalPages(data.totalPages);
          setTotalCount(data.totalCount);
        } else {
          toast.error(result.error || "Failed to fetch users");
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    roleFilter,
    statusFilter,
    initialData,
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers; // Already paginated from server

  const handleEditUser = async (userData: Partial<UserWithStats>) => {
    if (!selectedUser) return;

    try {
      const result = await updateUser(selectedUser.id, {
        name: userData.name,
        email: userData.email,
        phone: userData.phone || undefined,
        address: userData.address || undefined,
        city: userData.city || undefined,
        country: userData.country || undefined,
        status: userData.status,
        roleId: userData.roleId || undefined,
      });

      if (result.success) {
        toast.success("User updated successfully");
        setIsEditDialogOpen(false);
        // Refresh users list
        const fetchResult = await getAllUsers(
          currentPage,
          itemsPerPage,
          searchTerm || undefined,
          roleFilter !== "all" ? roleFilter : undefined,
          statusFilter !== "all" ? statusFilter : undefined
        );
        if (fetchResult.success && fetchResult.result) {
          const data = fetchResult.result as {
            users: UserWithStats[];
            totalPages: number;
            totalCount: number;
          };
          setUsers(data.users);
          setFilteredUsers(data.users);
        }
      } else {
        toast.error(result.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      const result = await suspendUser(userId);
      if (result.success) {
        toast.success("User suspended successfully");
        // Refresh users list
        const fetchResult = await getAllUsers(
          currentPage,
          itemsPerPage,
          searchTerm || undefined,
          roleFilter !== "all" ? roleFilter : undefined,
          statusFilter !== "all" ? statusFilter : undefined
        );
        if (fetchResult.success && fetchResult.result) {
          const data = fetchResult.result as {
            users: UserWithStats[];
            totalPages: number;
            totalCount: number;
          };
          setUsers(data.users);
          setFilteredUsers(data.users);
        }
      } else {
        toast.error(result.error || "Failed to suspend user");
      }
    } catch (error) {
      console.error("Error suspending user:", error);
      toast.error("Failed to suspend user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const result = await deleteUser(userId);
      if (result.success) {
        toast.success("User deleted successfully");
        // Refresh users list
        const fetchResult = await getAllUsers(
          currentPage,
          itemsPerPage,
          searchTerm || undefined,
          roleFilter !== "all" ? roleFilter : undefined,
          statusFilter !== "all" ? statusFilter : undefined
        );
        if (fetchResult.success && fetchResult.result) {
          const data = fetchResult.result as {
            users: UserWithStats[];
            totalPages: number;
            totalCount: number;
          };
          setUsers(data.users);
          setFilteredUsers(data.users);
        }
      } else {
        toast.error(result.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleSendPasswordReset = async (userId: string) => {
    try {
      const result = await sendPasswordResetToUser(userId);
      if (result.success) {
        toast.success("Password reset email sent");
      } else {
        toast.error(result.error || "Failed to send password reset email");
      }
    } catch (error) {
      console.error("Error sending password reset:", error);
      toast.error("Failed to send password reset email");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Listings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.isAdmin
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.status === "active"
                          ? "bg-green-100 text-green-800"
                          : user.status === "suspended"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell>N/A</TableCell>
                  <TableCell>{user.listingsCount || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendPasswordReset(user.id)}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuspendUser(user.id)}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
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

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1} to{" "}
          {Math.min(startIndex + itemsPerPage, totalCount)} of {totalCount}{" "}
          users
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* User Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="font-medium">
                    {selectedUser.phone || "Not provided"}
                  </p>
                </div>
                <div>
                  <Label>Role</Label>
                  <p className="font-medium">
                    {selectedUser.isAdmin ? "Admin" : "User"}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="font-medium capitalize">
                    {selectedUser.status}
                  </p>
                </div>
                <div>
                  <Label>Email Verified</Label>
                  <p className="font-medium">
                    {selectedUser.emailVerified ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="font-medium">
                    {selectedUser.createdAt?.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label>Last Login</Label>
                  <p className="font-medium">N/A</p>
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <p className="font-medium">
                  {selectedUser.address
                    ? `${selectedUser.address}, ${selectedUser.city}, ${selectedUser.country}`
                    : "Not provided"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <EditUserForm
              user={selectedUser}
              onSave={handleEditUser}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit User Form Component
function EditUserForm({
  user,
  onSave,
  onCancel,
}: {
  user: UserWithStats;
  onSave: (data: Partial<UserWithStats>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    address: user.address || "",
    city: user.city || "",
    country: user.country || "",
    isAdmin: user.isAdmin,
    status: user.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            required
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                status: value as "active" | "suspended" | "pending",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, city: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, country: e.target.value }))
            }
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isAdmin"
            checked={formData.isAdmin}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, isAdmin: e.target.checked }))
            }
            className="rounded"
          />
          <Label htmlFor="isAdmin">Admin Role</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
