"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserCheck,
  Shield,
  Activity,
  Mail,
  Plus,
  Package,
  Key,
  Tag,
  Image as ImageIcon,
  Star,
  Info,
} from "lucide-react";
import Link from "next/link";
import UserManagement from "./admin/UserManagement";
import RoleManagement from "./admin/RoleManagement";
import PermissionsManagement from "./admin/PermissionsManagement";
import { GetUserStatsResponse } from "@/lib/types";
import LogoutButton from "@/app/components/LogoutButton";
import { User } from "better-auth";

interface RoleFromDB {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: Date | null;
  updatedAt: Date;
  permissions: Permission[];
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
  initialRoles: RoleFromDB[] | null;
  initialPermissions: Permission[] | null;
}

export default function AdminDashboardContent({
  user,
  initialStats,
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
            {user && (
              <span className="font-bold text-sm ml-1">({user.email})</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Product Management */}
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

          {/* Category Management */}
          <Link href="/dashboard/categories/new">
            <Button variant="outline" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Add Category
            </Button>
          </Link>
          <Link href="/dashboard/categories">
            <Button variant="outline" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Manage Categories
            </Button>
          </Link>

          {/* Content Management */}
          <Link href="/dashboard/admin/content">
            <Button
              variant="outline"
              className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <ImageIcon className="w-4 h-4" />
              Content Management
            </Button>
          </Link>

          <LogoutButton />
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
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Content
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
          <UserManagement />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RoleManagement
            initialRoles={initialRoles}
            initialPermissions={initialPermissions}
          />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsManagement initialPermissions={initialPermissions} />
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <div className="space-y-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Homepage Content Management
              </h2>
              <p className="text-gray-600 mb-8">
                Manage your homepage content including hero slides, benefits,
                about section, and gallery.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <Link href="/dashboard/admin/content">
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="text-center">
                      <div className="p-3 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Overview
                      </h3>
                      <p className="text-sm text-gray-600">
                        View all content sections
                      </p>
                    </div>
                  </Card>
                </Link>

                <Link href="/dashboard/admin/content/homepage-hero">
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="text-center">
                      <div className="p-3 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Hero Slides
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manage hero section
                      </p>
                    </div>
                  </Card>
                </Link>

                <Link href="/dashboard/admin/content/benefits">
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="text-center">
                      <div className="p-3 bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Star className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Benefits
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manage benefit cards
                      </p>
                    </div>
                  </Card>
                </Link>

                <Link href="/dashboard/admin/content/about">
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="text-center">
                      <div className="p-3 bg-orange-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Info className="w-8 h-8 text-orange-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        About Section
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manage about content
                      </p>
                    </div>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
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
