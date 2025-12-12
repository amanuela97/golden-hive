"use client";

import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { InventoryRow } from "@/app/[locale]/actions/inventory-management";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  History,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import toast from "react-hot-toast";
import {
  adjustInventoryQuantity,
  updateCostPerItem,
  updateIncomingQuantity,
  getAdjustmentHistory,
  deleteInventoryLevel,
} from "@/app/[locale]/actions/inventory-management";

interface InventoryTableProps {
  data: InventoryRow[];
  onDataChange: () => void;
}

type PendingChange = {
  inventoryLevelId: string;
  inventoryItemId: string;
  locationId: string;
  available?: number;
  incoming?: number;
  costPerItem?: number;
};

export function InventoryTable({ data, onDataChange }: InventoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, PendingChange>
  >({});
  const [saving, setSaving] = useState(false);
  const [historyModal, setHistoryModal] = useState<{
    inventoryItemId: string;
    locationId: string;
    productName: string;
    variantTitle: string;
  } | null>(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState<
    Array<{
      id: string;
      change: number;
      reason: string | null;
      createdBy: string | null;
      createdByName: string | null;
      createdAt: Date | null;
    }>
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Get current value (pending or original)
  const getCurrentValue = (
    row: InventoryRow,
    field: "available" | "incoming" | "costPerItem"
  ) => {
    const pending = pendingChanges[row.inventoryLevelId];
    if (pending && pending[field] !== undefined) {
      return pending[field];
    }
    return row[field];
  };

  const handleValueChange = (
    row: InventoryRow,
    field: "available" | "incoming" | "costPerItem",
    value: number
  ) => {
    setPendingChanges((prev) => {
      const key = row.inventoryLevelId;
      const existing = prev[key] || {
        inventoryLevelId: row.inventoryLevelId,
        inventoryItemId: row.inventoryItemId,
        locationId: row.locationId,
      };

      // Check if value is same as original
      if (value === row[field]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _removed, ...rest } = existing;
        // If no other changes, remove the entry
        const hasOtherChanges =
          ("available" in rest && rest.available !== undefined) ||
          ("incoming" in rest && rest.incoming !== undefined) ||
          ("costPerItem" in rest && rest.costPerItem !== undefined);

        if (!hasOtherChanges) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [key]: _entry, ...remaining } = prev;
          return remaining;
        }
        return { ...prev, [key]: rest as PendingChange };
      }

      return {
        ...prev,
        [key]: { ...existing, [field]: value },
      };
    });
  };

  const handleIncrement = (
    row: InventoryRow,
    field: "available" | "incoming"
  ) => {
    const currentValue = getCurrentValue(row, field) as number;
    handleValueChange(row, field, currentValue + 1);
  };

  const handleDecrement = (
    row: InventoryRow,
    field: "available" | "incoming"
  ) => {
    const currentValue = getCurrentValue(row, field) as number;
    if (currentValue > 0) {
      handleValueChange(row, field, currentValue - 1);
    }
  };

  const handleDiscard = () => {
    setPendingChanges({});
  };

  const handleSave = async () => {
    setSaving(true);
    let hasErrors = false;

    for (const change of Object.values(pendingChanges)) {
      // Update available if changed
      if (change.available !== undefined) {
        const result = await adjustInventoryQuantity(
          change.inventoryLevelId,
          change.inventoryItemId,
          change.locationId,
          change.available,
          "manual"
        );
        if (!result.success) {
          toast.error(`Failed to update available: ${result.error}`);
          hasErrors = true;
        }
      }

      // Update incoming if changed
      if (change.incoming !== undefined) {
        const result = await updateIncomingQuantity(
          change.inventoryLevelId,
          change.incoming
        );
        if (!result.success) {
          toast.error(`Failed to update incoming: ${result.error}`);
          hasErrors = true;
        }
      }

      // Update cost if changed
      if (change.costPerItem !== undefined) {
        const result = await updateCostPerItem(
          change.inventoryItemId,
          change.costPerItem
        );
        if (!result.success) {
          toast.error(`Failed to update cost: ${result.error}`);
          hasErrors = true;
        }
      }
    }

    setSaving(false);

    if (!hasErrors) {
      toast.success("Changes saved successfully");
      setPendingChanges({});
      onDataChange();
    }
  };

  const handleViewHistory = async (
    inventoryItemId: string,
    locationId: string,
    productName: string,
    variantTitle: string
  ) => {
    setHistoryModal({ inventoryItemId, locationId, productName, variantTitle });
    setLoadingHistory(true);

    const result = await getAdjustmentHistory(inventoryItemId, locationId);

    if (result.success && result.data) {
      setAdjustmentHistory(result.data);
    } else {
      toast.error(result.error || "Failed to load history");
      setAdjustmentHistory([]);
    }

    setLoadingHistory(false);
  };

  const TableHeaderWithTooltip = ({
    children,
    tooltip,
  }: {
    children: React.ReactNode;
    tooltip: string;
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="border-b-2 border-dotted border-black cursor-help inline-block">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="whitespace-normal break-words">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedIds = selectedRows.map(
      (row) => row.original.inventoryLevelId
    );

    if (selectedIds.length === 0) {
      return;
    }

    try {
      // Delete all selected inventory levels
      const deletePromises = selectedIds.map((id) => deleteInventoryLevel(id));
      const results = await Promise.all(deletePromises);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(
          `${successCount} inventory item${successCount > 1 ? "s" : ""} deleted successfully`
        );
        onDataChange(); // Refresh data
      }
      if (failCount > 0) {
        toast.error(
          `${failCount} inventory item${failCount > 1 ? "s" : ""} failed to delete`
        );
      }

      // Clear selection
      setRowSelection({});
      setBulkDeleteConfirm(false);
    } catch (error) {
      toast.error("Failed to delete inventory items");
      console.error("Bulk delete error:", error);
    }
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns: ColumnDef<InventoryRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
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
    },
    {
      accessorKey: "productName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Product / Variant
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="flex flex-col gap-1">
            <Link
              href={`/dashboard/products/${row.original.listingId}/edit`}
              className="font-medium hover:text-primary hover:underline"
            >
              {row.original.productName}
            </Link>
            <span className="text-sm text-muted-foreground">
              {row.original.variantTitle}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => {
        return (
          <span className="text-sm">
            {row.original.sku || (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "locationName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Location
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <span className="text-sm">{row.original.locationName}</span>;
      },
    },
    {
      accessorKey: "available",
      header: () => (
        <TableHeaderWithTooltip tooltip="Units at a specific location that are for sale.">
          Available
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        const currentValue = getCurrentValue(
          row.original,
          "available"
        ) as number;
        const isLowStock = currentValue <= 5;
        const hasChange =
          pendingChanges[row.original.inventoryLevelId]?.available !==
          undefined;

        return (
          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    handleValueChange(row.original, "available", val);
                  }
                }}
                className={`w-24 h-8 pr-6 ${hasChange ? "border-orange-500" : ""} ${isLowStock ? "text-red-600 font-semibold" : ""}`}
              />
              <div className="absolute right-1 flex flex-col">
                <button
                  type="button"
                  onClick={() => handleIncrement(row.original, "available")}
                  className="h-3 w-4 flex items-center justify-center hover:bg-muted rounded-t"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDecrement(row.original, "available")}
                  className="h-3 w-4 flex items-center justify-center hover:bg-muted rounded-b"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
            {isLowStock && (
              <span className="text-xs text-red-600 font-medium">Low</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "committed",
      header: () => (
        <TableHeaderWithTooltip tooltip="Units that are reserved for an order but not yet fulfilled.">
          Committed
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {row.original.committed || 0}
          </span>
        );
      },
    },
    {
      accessorKey: "incoming",
      header: () => (
        <TableHeaderWithTooltip tooltip="Units that are on the way, but not yet received.">
          Incoming
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        const currentValue = getCurrentValue(
          row.original,
          "incoming"
        ) as number;
        const hasChange =
          pendingChanges[row.original.inventoryLevelId]?.incoming !== undefined;

        return (
          <div className="relative flex items-center">
            <Input
              type="number"
              value={currentValue}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  handleValueChange(row.original, "incoming", val);
                }
              }}
              className={`w-24 h-8 pr-6 ${hasChange ? "border-orange-500" : ""}`}
            />
            <div className="absolute right-1 flex flex-col">
              <button
                type="button"
                onClick={() => handleIncrement(row.original, "incoming")}
                className="h-3 w-4 flex items-center justify-center hover:bg-muted rounded-t"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDecrement(row.original, "incoming")}
                className="h-3 w-4 flex items-center justify-center hover:bg-muted rounded-b"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "onHand",
      header: () => (
        <TableHeaderWithTooltip tooltip="The sum of available, committed, and incoming.">
          On hand
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        const available = getCurrentValue(row.original, "available") as number;
        const incoming = getCurrentValue(row.original, "incoming") as number;
        const onHand = available + row.original.committed + incoming;
        return <span className="text-sm font-medium">{onHand}</span>;
      },
    },
    {
      accessorKey: "costPerItem",
      header: () => (
        <TableHeaderWithTooltip tooltip="The total expense to produce, acquire, or deliver a single product.">
          Cost per item
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        const currentValue = getCurrentValue(
          row.original,
          "costPerItem"
        ) as string;
        const hasChange =
          pendingChanges[row.original.inventoryLevelId]?.costPerItem !==
          undefined;

        return (
          <Input
            type="number"
            step="0.01"
            value={currentValue}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0) {
                handleValueChange(row.original, "costPerItem", val);
              }
            }}
            className={`w-28 h-8 ${hasChange ? "border-orange-500" : ""}`}
          />
        );
      },
    },
    {
      accessorKey: "variantPrice",
      header: () => (
        <TableHeaderWithTooltip tooltip="Price of the variant item/product.">
          Price
        </TableHeaderWithTooltip>
      ),
      cell: ({ row }) => {
        const price = parseFloat(row.original.variantPrice || "0");
        return (
          <span className="text-sm font-medium">
            {row.original.currency} {price.toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: "inventoryValue",
      header: "Inventory value",
      cell: ({ row }) => {
        const available = getCurrentValue(row.original, "available") as number;
        const incoming = getCurrentValue(row.original, "incoming") as number;
        const onHand = available + row.original.committed + incoming;
        const costPerItem = parseFloat(
          (getCurrentValue(row.original, "costPerItem") as string) || "0"
        );
        const variantPrice = parseFloat(row.original.variantPrice || "0");

        // If cost_per_item is not zero, calculate: (price * onHand) - (costPerItem * onHand)
        // Otherwise, use price * onHand
        const value =
          costPerItem > 0
            ? variantPrice * onHand - costPerItem * onHand
            : variantPrice * onHand;

        return (
          <span className="text-sm font-medium">
            {row.original.currency} {value.toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              handleViewHistory(
                row.original.inventoryItemId,
                row.original.locationId,
                row.original.productName,
                row.original.variantTitle
              )
            }
            title="View adjustment history"
          >
            <History className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
    state: {
      sorting,
      rowSelection,
    },
  });

  return (
    <>
      {/* Bulk Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500 bg-orange-50 px-4 py-3 mb-4">
          <span className="text-sm font-medium text-orange-900">
            {selectedCount} inventory item{selectedCount > 1 ? "s" : ""}{" "}
            selected
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

      {/* Unsaved Changes Banner */}
      {hasPendingChanges && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-orange-500 bg-orange-50 px-4 py-3">
          <span className="text-sm font-medium text-orange-900">
            Unsaved changes
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No inventory items found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            data.length
          )}{" "}
          of {data.length} results
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
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
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Adjustment History Modal */}
      {historyModal && (
        <Dialog open onOpenChange={() => setHistoryModal(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adjustment History</DialogTitle>
              <DialogDescription>
                {historyModal.productName} - {historyModal.variantTitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-4">
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : adjustmentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No adjustment history found.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[180px_80px_1fr_200px] gap-4 px-4 py-2 text-sm font-medium border-b">
                    <div>Date & Time</div>
                    <div>Change</div>
                    <div>Reason</div>
                    <div>By</div>
                  </div>
                  {adjustmentHistory.map((adj) => (
                    <div
                      key={adj.id}
                      className="grid grid-cols-[180px_80px_1fr_200px] gap-4 px-4 py-2 text-sm border-b last:border-0"
                    >
                      <div className="text-muted-foreground">
                        {adj.createdAt
                          ? new Date(adj.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </div>
                      <div
                        className={
                          adj.change > 0
                            ? "text-green-600 font-medium"
                            : adj.change < 0
                              ? "text-red-600 font-medium"
                              : ""
                        }
                      >
                        {adj.change > 0 ? "+" : ""}
                        {adj.change}
                      </div>
                      <div className="text-muted-foreground">
                        {adj.reason || "—"}
                      </div>
                      <div className="text-muted-foreground">
                        {adj.createdByName || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setHistoryModal(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
