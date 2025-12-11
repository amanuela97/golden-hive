"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Link } from "@/i18n/navigation";
import { adminDeleteProductAction } from "../../../actions/products";
import toast from "react-hot-toast";
import Image from "next/image";

interface ProductWithUser {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string;
  currency: string;
  stockQuantity: number | null;
  unit: string | null;
  imageUrl: string | null;
  isActive: boolean | null;
  isFeatured: boolean | null;
  createdAt: Date;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOwner, setFilterOwner] = useState<"all" | "admin" | "seller">(
    "all"
  );
  const [productToDelete, setProductToDelete] =
    useState<ProductWithUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.producerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.producerEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesOwner =
      filterOwner === "all" ||
      (filterOwner === "admin" && product.isAdminCreated) ||
      (filterOwner === "seller" && !product.isAdminCreated);

    return matchesSearch && matchesOwner;
  });

  const handleDeleteProduct = async (product: ProductWithUser) => {
    try {
      const result = await adminDeleteProductAction(product.id);
      if (result.success) {
        toast.success("Product deleted successfully");
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to delete product");
      }
    } catch (error) {
      toast.error("Failed to delete product");
      console.error("Delete product error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div>
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

        <Link href="/dashboard/products/new">
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
                            width={40}
                            height={40}
                            className="rounded object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.category || "Uncategorized"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.isAdminCreated ? (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <User className="h-4 w-4 text-blue-500" />
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {product.producerName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product.producerEmail}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                        {product.isFeatured && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.currency}{" "}
                      {typeof product.price === "number"
                        ? Number(product.price).toFixed(2)
                        : product.price}{" "}
                      / {product.unit}
                    </TableCell>
                    <TableCell>{product.stockQuantity}</TableCell>
                    <TableCell>
                      {new Date(product.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/products/${product.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
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
                            <Trash2 className="h-4 w-4 mr-2" />
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
