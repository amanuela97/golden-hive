"use client";
import { User } from "better-auth";
import { Listing } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  TrendingUp,
  Eye,
  Star,
  Plus,
  Settings,
  FileText,
} from "lucide-react";
import Link from "next/link";
import SettingsModal from "./shared/SettingsModal";
import LogoutButton from "@/app/components/LogoutButton";
import { useState, useCallback } from "react";

interface SellerDashboardContentProps {
  user: User;
  products: Listing[];
  isCredential: boolean;
}

export default function SellerDashboardContent({
  products,
  user,
  isCredential,
}: SellerDashboardContentProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSettingsOpen = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  // Calculate analytics
  const totalProducts = products?.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const featuredProducts = products.filter((p) => p.isFeatured).length;
  const totalStock = products.reduce(
    (sum, p) => sum + (p.stockQuantity || 0),
    0
  );
  const lowStockProducts = products.filter(
    (p) => (p.stockQuantity || 0) < 10
  ).length;

  // Recent products (last 5)
  const recentProducts = products
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.name || user?.email}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Products
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalProducts}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Products
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeProducts}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Featured</p>
                <p className="text-2xl font-bold text-gray-900">
                  {featuredProducts}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Stock</p>
                <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/dashboard/seller/products/new">
                <Button className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Product
                </Button>
              </Link>
              <Link href="/dashboard/seller/products">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  Manage Products
                </Button>
              </Link>
              <Link href="/dashboard/seller/documentation">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Documentation
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSettingsOpen}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Inventory Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Low Stock Items</span>
                <span
                  className={`text-sm font-medium ${
                    lowStockProducts > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {lowStockProducts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Products</span>
                <span className="text-sm font-medium text-green-600">
                  {activeProducts}/{totalProducts}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {recentProducts.length > 0 ? (
                recentProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-600 truncate">
                      {product.name}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        product.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {product.isActive ? "Active" : "Draft"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No products yet</p>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Products Table */}
        {recentProducts.length > 0 && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Products</h3>
              <Link href="/dashboard/seller/products">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">
                      Product
                    </th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">
                      Category
                    </th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">
                      Price
                    </th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">
                      Stock
                    </th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map((product) => (
                    <tr key={product.id} className="border-b">
                      <td className="py-3">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(product.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {product.category || "Uncategorized"}
                        </span>
                      </td>
                      <td className="py-3">
                        {product.currency} {product.price}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            (product.stockQuantity || 0) > 10
                              ? "bg-green-100 text-green-800"
                              : (product.stockQuantity || 0) > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.stockQuantity || 0} units
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            product.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {product.isActive ? "Active" : "Draft"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        isCredential={isCredential}
      />
    </div>
  );
}
