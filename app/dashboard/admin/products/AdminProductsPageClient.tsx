"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Crown,
  User,
  CheckCircle,
  XCircle,
  Star,
} from "lucide-react";
import Link from "next/link";
import { Listing } from "@/lib/listing";
import { adminDeleteProductAction } from "@/app/actions/products";
import toast from "react-hot-toast";
import Image from "next/image";

interface ProductWithUser extends Listing {
  producerName: string;
  producerEmail: string;
  isAdminCreated: boolean;
}

interface AdminProductsPageClientProps {
  products: ProductWithUser[];
}

export default function AdminProductsPageClient({
  products,
}: AdminProductsPageClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filterOwner, setFilterOwner] = useState<"all" | "admin" | "seller">(
    "all"
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<ProductWithUser | null>(null);

  // Filter products based on search term and filters
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.producerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && product.isActive) ||
      (filterStatus === "inactive" && !product.isActive);

    const matchesOwner =
      filterOwner === "all" ||
      (filterOwner === "admin" && product.isAdminCreated) ||
      (filterOwner === "seller" && !product.isAdminCreated);

    return matchesSearch && matchesStatus && matchesOwner;
  });

  const handleDeleteProduct = async (product: ProductWithUser) => {
    try {
      const result = await adminDeleteProductAction(product.id);
      if (result.success) {
        toast.success("Product deleted successfully");
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="destructive"
          className="bg-red-100 text-red-800 border-red-200"
        >
          <XCircle className="w-3 h-3 mr-1" />
          Inactive
        </Badge>
      );
    }
  };

  const getOwnerBadge = (isAdminCreated: boolean) => {
    if (isAdminCreated) {
      return (
        <Badge
          variant="default"
          className="bg-purple-100 text-purple-800 border-purple-200"
        >
          <Crown className="w-3 h-3 mr-1" />
          Platform-Owned
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-800 border-blue-200"
        >
          <User className="w-3 h-3 mr-1" />
          Seller
        </Badge>
      );
    }
  };

  const getFeaturedBadge = (isFeatured: boolean) => {
    if (isFeatured) {
      return (
        <Badge
          variant="default"
          className="bg-yellow-100 text-yellow-800 border-yellow-200"
        >
          <Star className="w-3 h-3 mr-1" />
          Featured
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search products or sellers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "active" | "inactive")
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filterOwner}
            onChange={(e) =>
              setFilterOwner(e.target.value as "all" | "admin" | "seller")
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Owners</option>
            <option value="admin">Platform-Owned</option>
            <option value="seller">Seller</option>
          </select>
        </div>

        <Link href="/dashboard/admin/products/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Products ({filteredProducts.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No products found matching your criteria.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.imageUrl && (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                            width={48}
                            height={48}
                          />
                        )}
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            {product.producerName}
                          </div>
                          {getFeaturedBadge(product.isFeatured || false)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getOwnerBadge(product.isAdminCreated)}
                        <div className="text-sm text-gray-500">
                          {product.producerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(product.isActive || false)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {product.currency} {product.price}
                      </div>
                      <div className="text-sm text-gray-500">
                        per {product.unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {product.stockQuantity} {product.unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {new Date(product.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/admin/products/${product.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setProductToDelete(product);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProductToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                productToDelete && handleDeleteProduct(productToDelete)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
