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
// import { updateUser, suspendUser, deleteUser } from "@/app/actions/admin";
import { User } from "better-auth";
import toast from "react-hot-toast";

// Mock functions - replace with real API calls
const updateUser = async (
  _userId: string,
  _userData: Record<string, unknown>
) => {
  // Mock implementation
  return Promise.resolve();
};

const suspendUser = async (_userId: string) => {
  // Mock implementation
  return Promise.resolve();
};

const deleteUser = async (_userId: string) => {
  // Mock implementation
  return Promise.resolve();
};

interface UserWithStats extends User {
  lastLogin?: string;
  listingsCount?: number;
  status: "active" | "suspended" | "pending";
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  isAdmin: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Mock data for now - will be replaced with real API calls
  useEffect(() => {
    const mockUsers: UserWithStats[] = [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        emailVerified: true,
        isAdmin: false,
        phone: "+1234567890",
        address: "123 Main St",
        city: "New York",
        country: "USA",
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
        lastLogin: "2024-01-20",
        listingsCount: 5,
        status: "active",
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        emailVerified: true,
        isAdmin: true,
        phone: "+1234567891",
        address: "456 Oak Ave",
        city: "Los Angeles",
        country: "USA",
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-10"),
        lastLogin: "2024-01-19",
        listingsCount: 12,
        status: "active",
      },
      {
        id: "3",
        name: "Bob Johnson",
        email: "bob@example.com",
        emailVerified: false,
        isAdmin: false,
        phone: "+1234567892",
        address: "789 Pine St",
        city: "Chicago",
        country: "USA",
        createdAt: new Date("2024-01-18"),
        updatedAt: new Date("2024-01-18"),
        lastLogin: "2024-01-18",
        listingsCount: 0,
        status: "pending",
      },
    ];

    setUsers(mockUsers);
    setFilteredUsers(mockUsers);
    setLoading(false);
  }, []);

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) =>
        roleFilter === "admin" ? user.isAdmin : !user.isAdmin
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleEditUser = async (userData: Partial<UserWithStats>) => {
    if (!selectedUser) return;

    try {
      await updateUser(selectedUser.id, userData);
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      // Refresh users list
    } catch {
      toast.error("Failed to update user");
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      await suspendUser(userId);
      toast.success("User suspended successfully");
      // Refresh users list
    } catch {
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
      await deleteUser(userId);
      toast.success("User deleted successfully");
      // Refresh users list
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleSendPasswordReset = async () => {
    try {
      // Implement password reset functionality
      toast.success("Password reset email sent");
    } catch {
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
                  <TableCell>{user.lastLogin || "Never"}</TableCell>
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
                        onClick={handleSendPasswordReset}
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
          {Math.min(startIndex + itemsPerPage, filteredUsers.length)} of{" "}
          {filteredUsers.length} users
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
            disabled={currentPage === totalPages}
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
                  <p className="font-medium">
                    {selectedUser.lastLogin || "Never"}
                  </p>
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
