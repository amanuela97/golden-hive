"use client";

import React, { useState } from "react";
import { User } from "better-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserCheck,
  Shield,
  BarChart3,
  Activity,
  Mail,
  Plus,
  Package,
} from "lucide-react";
import Link from "next/link";
import UserManagement from "./admin/UserManagement";
import RoleManagement from "./admin/RoleManagement";
import { GetAllUsersResponse, GetUserStatsResponse } from "@/lib/types";

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

interface AdminDashboardContentProps {
  user: User;
  initialStats: GetUserStatsResponse | null;
  initialUsers: GetAllUsersResponse | null;
  initialRoles: RoleFromDB[] | null;
  initialPermissions: Permission[] | null;
}

export default function AdminDashboardContent({
  user: _user,
  initialStats,
  initialUsers,
  initialRoles,
  initialPermissions,
}: AdminDashboardContentProps) {
  const [activeTab, setActiveTab] = useState("users");

  // Use initial data from props
  const stats = initialStats || {
    totalUsers: 0,
    adminUsers: 0,
    verifiedUsers: 0,
    activeUsers: 0,
    recentSignups: 0,
  };

  return (
    <div className="h-screen space-y-6 py-4 px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage users, roles, and system analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/products/new">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </Link>
          <Link href="/dashboard/products">
            <Button variant="outline" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Manage Products
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalUsers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.activeUsers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.adminUsers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Recent Signups
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.recentSignups}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger
            value="communication"
            className="flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Communication
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserManagement initialData={initialUsers} />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RoleManagement
            initialRoles={initialRoles}
            initialPermissions={initialPermissions}
          />
        </TabsContent>

        {/*<TabsContent value="analytics" className="mt-6">
          <Analytics />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <ActivityLogs />
        </TabsContent>

        <TabsContent value="communication" className="mt-6">
          <CommunicationTools />
        </TabsContent>*/}
      </Tabs>
    </div>
  );
}
