"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type CellContext,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { Listing } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import { getStoreSetupStatus } from "@/app/[locale]/actions/store-setup";
import { checkStripePaymentReadiness } from "@/app/[locale]/actions/stripe-connect";
// Categories are now handled via taxonomy - no longer using old category system

interface ProductTableProps {
  products: (Listing & {
    variantCount?: number;
    totalStock?: number;
    storeName?: string | null;
  })[];
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onToggleStatus: (
    id: string
  ) => Promise<{ success: boolean; product?: Listing; error?: string }>;
  onToggleFeatured: (
    id: string
  ) => Promise<{ success: boolean; product?: Listing; error?: string }>;
  onSelectionChange?: (selectedIds: string[]) => void;
  basePath: string; // e.g., "/dashboard/admin" or "/dashboard/seller"
  isAdmin?: boolean; // Whether current user is admin
}

export default function ProductTable({
  products,
  onDelete,
  onToggleStatus,
  onToggleFeatured,
  onSelectionChange,
  basePath,
  isAdmin = false,
}: ProductTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false }, // Default sort by createdAt A-Z
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt-asc");
  const [canCreateProduct, setCanCreateProduct] = useState(true);
  // Categories are now handled via taxonomy - removed old category system

  // Check Stripe setup status for all users (sellers and admins)
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const [setupStatus, paymentReadiness] = await Promise.all([
          getStoreSetupStatus(),
          checkStripePaymentReadiness(),
        ]);

        // Allow product creation only if store is set up AND Stripe is ready
        // This applies to both sellers and admins
        const canCreate =
          setupStatus.hasStore &&
          setupStatus.hasStripeAccount &&
          paymentReadiness.isReady;

        setCanCreateProduct(canCreate);
      } catch (error) {
        console.error("Error checking setup status:", error);
        // On error, allow creation (fail open) - server action will still block
        setCanCreateProduct(true);
      }
    };

    checkSetupStatus();
  }, []);

  const columns = useMemo<ColumnDef<Listing>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) =>
              table.toggleAllPageRowsSelected(!!e.target.checked)
            }
            className="rounded border-gray-300"
            ref={(el) => {
              if (el)
                el.indeterminate =
                  !table.getIsAllPageRowsSelected() &&
                  table.getIsSomePageRowsSelected();
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(!!e.target.checked)}
            className="rounded border-gray-300"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "image",
        header: "Image",
        cell: ({ row }) => {
          const imageUrl = row.original.imageUrl;
          return (
            <div className="w-12 h-12 relative rounded-md overflow-hidden bg-gray-100">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Product"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue, row }) => (
          <div>
            <div className="font-medium">{getValue() as string}</div>
            <div className="text-sm text-gray-500">ID: {row.original.id}</div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const statusLabels: Record<string, string> = {
            active: "Active",
            draft: "Draft",
            archived: "Archived",
          };
          const statusColors: Record<string, string> = {
            active: "bg-green-100 text-green-800",
            draft: "bg-gray-100 text-gray-800",
            archived: "bg-red-100 text-red-800",
          };
          return (
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                statusColors[status] || statusColors.draft
              }`}
            >
              {statusLabels[status] || "Draft"}
            </span>
          );
        },
      },
      {
        id: "inventory",
        header: "Inventory",
        accessorFn: (row) => {
          const product = row as Listing & { totalStock?: number };
          return product.totalStock || 0;
        },
        cell: ({ row }) => {
          const variantCount =
            (row.original as { variantCount?: number }).variantCount || 0;
          const totalStock =
            (row.original as { totalStock?: number }).totalStock || 0;
          if (variantCount === 0) {
            return <span className="text-sm text-gray-500">No variants</span>;
          }
          return (
            <span className="text-sm">
              {totalStock} in stock for {variantCount} variant
              {variantCount !== 1 ? "s" : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "taxonomyCategoryName",
        header: "Category",
        cell: ({ getValue }) => (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {(getValue() as string) || "Uncategorized"}
          </span>
        ),
      },
      // Hidden sortable columns for createdAt, updatedAt, publishedAt
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: () => null,
        cell: () => null,
        enableHiding: true,
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: () => null,
        cell: () => null,
        enableHiding: true,
      },
      {
        id: "publishedAt",
        accessorKey: "publishedAt",
        header: () => null,
        cell: () => null,
        enableHiding: true,
      },
      ...(isAdmin
        ? [
            {
              id: "store",
              header: "Store",
              accessorFn: (row: Listing & { storeName?: string | null }) => {
                return row.storeName || "No store";
              },
              cell: ({ row }: CellContext<Listing, unknown>) => {
                const product = row.original as Listing & {
                  storeName?: string | null;
                };
                return (
                  <span className="text-sm">
                    {product.storeName || "No store"}
                  </span>
                );
              },
              sortingFn: (
                rowA: { original: Listing & { storeName?: string | null } },
                rowB: { original: Listing & { storeName?: string | null } }
              ) => {
                const a = rowA.original;
                const b = rowB.original;
                const aName = a.storeName || "";
                const bName = b.storeName || "";
                return aName.localeCompare(bName);
              },
            },
            {
              accessorKey: "isFeatured",
              header: "Featured",
              cell: ({ getValue, row }: CellContext<Listing, unknown>) => (
                <button
                  onClick={async () => {
                    if (!isAdmin) {
                      toast.error("Only admins can toggle featured status");
                      return;
                    }
                    try {
                      const result = await onToggleFeatured(row.original.id);
                      if (!result.success) {
                        toast.error(
                          result.error || "Failed to toggle featured status"
                        );
                      }
                    } catch (error) {
                      toast.error("Failed to toggle featured status");
                      console.error("Toggle featured error:", error);
                    }
                  }}
                  disabled={!isAdmin}
                  className={`p-1 rounded ${
                    getValue() ? "text-yellow-500" : "text-gray-400"
                  } ${
                    isAdmin
                      ? getValue()
                        ? "hover:text-yellow-600"
                        : "hover:text-yellow-500"
                      : "cursor-not-allowed opacity-50"
                  }`}
                  title={
                    isAdmin
                      ? "Toggle featured status"
                      : "Only admins can toggle featured status"
                  }
                >
                  {getValue() ? (
                    <Star className="w-4 h-4 fill-current" />
                  ) : (
                    <StarOff className="w-4 h-4" />
                  )}
                </button>
              ),
              enableSorting: false,
            },
          ]
        : []),
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link href={`${basePath}/products/${row.original.id}`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const result = await onToggleStatus(row.original.id);
                  if (!result.success) {
                    toast.error(result.error || "Failed to toggle status");
                  }
                } catch (error) {
                  toast.error("Failed to toggle status");
                  console.error("Toggle status error:", error);
                }
              }}
            >
              {row.original.status === "active" ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(row.original.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    [onToggleStatus, onToggleFeatured, basePath, isAdmin]
  );

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      columnVisibility: {
        createdAt: false,
        updatedAt: false,
        publishedAt: false,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize: 10,
      },
      columnVisibility: {
        createdAt: false,
        updatedAt: false,
        publishedAt: false,
      },
    },
  });

  // Handle status filter
  React.useEffect(() => {
    if (statusFilter === "all") {
      setColumnFilters((prev) => prev.filter((f) => f.id !== "status"));
    } else {
      setColumnFilters((prev) => {
        const filtered = prev.filter((f) => f.id !== "status");
        return [...filtered, { id: "status", value: statusFilter }];
      });
    }
  }, [statusFilter]);

  // Handle sorting
  React.useEffect(() => {
    const [sortField, sortDirection] = sortBy.split("-");
    const desc = sortDirection === "desc";

    if (sortField === "inventory") {
      // Custom sorting for inventory (totalStock)
      setSorting([
        {
          id: "inventory",
          desc,
        },
      ]);
    } else if (sortField === "store" && isAdmin) {
      // Custom sorting for store
      setSorting([
        {
          id: "store",
          desc,
        },
      ]);
    } else {
      // Standard sorting for createdAt, updatedAt, publishedAt
      setSorting([
        {
          id: sortField,
          desc,
        },
      ]);
    }
  }, [sortBy, isAdmin]);

  // Notify parent component of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedIds = table
        .getSelectedRowModel()
        .rows.map((row) => row.original.id);
      onSelectionChange(selectedIds);
    }
  }, [rowSelection, onSelectionChange, table]);

  const handleDelete = async (id: string) => {
    try {
      const result = await onDelete(id);
      if (result.success) {
        setDeleteConfirm(null);
        toast.success("Product deleted successfully");
      } else {
        toast.error(result.error || "Failed to delete product");
      }
    } catch (error) {
      toast.error("Failed to delete product");
      console.error("Delete error:", error);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => row.original.id);

    if (selectedIds.length === 0) {
      return;
    }

    try {
      // Delete all selected products
      const deletePromises = selectedIds.map((id) => onDelete(id));
      const results = await Promise.all(deletePromises);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(
          `${successCount} product${successCount > 1 ? "s" : ""} deleted successfully`
        );
      }
      if (failCount > 0) {
        toast.error(
          `${failCount} product${failCount > 1 ? "s" : ""} failed to delete`
        );
      }

      // Clear selection
      setRowSelection({});
      setBulkDeleteConfirm(false);
    } catch (error) {
      toast.error("Failed to delete products");
      console.error("Bulk delete error:", error);
    }
  };

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-4">
      {/* Bulk Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500 bg-orange-50 px-4 py-3">
          <span className="text-sm font-medium text-orange-900">
            {selectedCount} product{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRowSelection({});
                setBulkDeleteConfirm(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (bulkDeleteConfirm) {
                  handleBulkDelete();
                } else {
                  setBulkDeleteConfirm(true);
                }
              }}
            >
              {bulkDeleteConfirm ? "Confirm Delete" : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {/* Header with filters and actions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-asc">Created: A-Z</SelectItem>
                  <SelectItem value="createdAt-desc">Created: Z-A</SelectItem>
                  <SelectItem value="updatedAt-desc">
                    Updated: Latest
                  </SelectItem>
                  <SelectItem value="updatedAt-asc">Updated: Oldest</SelectItem>
                  <SelectItem value="publishedAt-desc">
                    Published: Latest
                  </SelectItem>
                  <SelectItem value="publishedAt-asc">
                    Published: Oldest
                  </SelectItem>
                  <SelectItem value="inventory-desc">
                    Inventory: Highest
                  </SelectItem>
                  <SelectItem value="inventory-asc">
                    Inventory: Lowest
                  </SelectItem>
                  {isAdmin && (
                    <>
                      <SelectItem value="store-asc">Store: A-Z</SelectItem>
                      <SelectItem value="store-desc">Store: Z-A</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {canCreateProduct && (
            <Link href={`${basePath}/products/new`}>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-700">
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Product</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this product? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
