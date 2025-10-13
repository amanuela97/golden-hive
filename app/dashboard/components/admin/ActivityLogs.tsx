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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Search,
  Download,
  Eye,
  User,
  Shield,
  Key,
  Edit,
  Plus,
} from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  status: "success" | "failed" | "warning";
  category:
    | "authentication"
    | "user_management"
    | "product_management"
    | "system";
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Mock data - replace with real API calls
  useEffect(() => {
    const mockLogs: ActivityLog[] = [
      {
        id: "1",
        userId: "1",
        userName: "John Doe",
        userEmail: "john@example.com",
        action: "login",
        description: "User logged in successfully",
        timestamp: "2024-01-20T10:30:00Z",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        status: "success",
        category: "authentication",
      },
      {
        id: "2",
        userId: "2",
        userName: "Jane Smith",
        userEmail: "jane@example.com",
        action: "create_user",
        description: "Created new user account for bob@example.com",
        timestamp: "2024-01-20T09:15:00Z",
        ipAddress: "192.168.1.101",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        status: "success",
        category: "user_management",
      },
      {
        id: "3",
        userId: "3",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        action: "failed_login",
        description: "Failed login attempt - incorrect password",
        timestamp: "2024-01-20T08:45:00Z",
        ipAddress: "192.168.1.102",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
        status: "failed",
        category: "authentication",
      },
      {
        id: "4",
        userId: "1",
        userName: "John Doe",
        userEmail: "john@example.com",
        action: "update_profile",
        description: "Updated user profile information",
        timestamp: "2024-01-20T07:20:00Z",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        status: "success",
        category: "user_management",
      },
      {
        id: "5",
        userId: "2",
        userName: "Jane Smith",
        userEmail: "jane@example.com",
        action: "delete_user",
        description: "Deleted user account for olduser@example.com",
        timestamp: "2024-01-19T16:30:00Z",
        ipAddress: "192.168.1.101",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        status: "success",
        category: "user_management",
      },
      {
        id: "6",
        userId: "1",
        userName: "John Doe",
        userEmail: "john@example.com",
        action: "create_product",
        description: "Created new product: Organic Honey",
        timestamp: "2024-01-19T14:15:00Z",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        status: "success",
        category: "product_management",
      },
      {
        id: "7",
        userId: "3",
        userName: "Bob Johnson",
        userEmail: "bob@example.com",
        action: "password_reset",
        description: "Requested password reset",
        timestamp: "2024-01-19T11:45:00Z",
        ipAddress: "192.168.1.102",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15",
        status: "success",
        category: "authentication",
      },
      {
        id: "8",
        userId: "2",
        userName: "Jane Smith",
        userEmail: "jane@example.com",
        action: "suspend_user",
        description: "Suspended user account for spammer@example.com",
        timestamp: "2024-01-19T09:30:00Z",
        ipAddress: "192.168.1.101",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        status: "success",
        category: "user_management",
      },
    ];

    setLogs(mockLogs);
    setFilteredLogs(mockLogs);
    setLoading(false);
  }, []);

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action filter
    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((log) => log.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((log) => log.status === statusFilter);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [logs, searchTerm, actionFilter, categoryFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case "login":
      case "failed_login":
        return <User className="w-4 h-4" />;
      case "create_user":
      case "update_user":
      case "delete_user":
      case "suspend_user":
        return <Shield className="w-4 h-4" />;
      case "password_reset":
        return <Key className="w-4 h-4" />;
      case "create_product":
      case "update_product":
      case "delete_product":
        return <Plus className="w-4 h-4" />;
      case "update_profile":
        return <Edit className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "authentication":
        return "bg-blue-100 text-blue-800";
      case "user_management":
        return "bg-purple-100 text-purple-800";
      case "product_management":
        return "bg-green-100 text-green-800";
      case "system":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">Loading activity logs...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Activity Logs</h2>
          <p className="text-gray-600">
            Monitor system activity and user actions
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="failed_login">Failed Login</SelectItem>
                  <SelectItem value="create_user">Create User</SelectItem>
                  <SelectItem value="update_user">Update User</SelectItem>
                  <SelectItem value="delete_user">Delete User</SelectItem>
                  <SelectItem value="suspend_user">Suspend User</SelectItem>
                  <SelectItem value="password_reset">Password Reset</SelectItem>
                  <SelectItem value="create_product">Create Product</SelectItem>
                  <SelectItem value="update_product">Update Product</SelectItem>
                  <SelectItem value="delete_product">Delete Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="user_management">
                    User Management
                  </SelectItem>
                  <SelectItem value="product_management">
                    Product Management
                  </SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setActionFilter("all");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.userName}</div>
                      <div className="text-sm text-gray-500">
                        {log.userEmail}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="capitalize">
                        {log.action.replace("_", " ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.description}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(log.category)}`}
                    >
                      {log.category.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(log.status)}`}
                    >
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTimestamp(log.timestamp)}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {log.ipAddress}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
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
          {Math.min(startIndex + itemsPerPage, filteredLogs.length)} of{" "}
          {filteredLogs.length} logs
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
    </div>
  );
}
