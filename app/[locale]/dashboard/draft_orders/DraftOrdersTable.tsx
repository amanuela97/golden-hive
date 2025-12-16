"use client";

import React, { useState, useMemo, useCallback } from "react";
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
import type { DraftOrderRow } from "@/app/[locale]/actions/draft-orders";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { deleteDraftOrders } from "@/app/[locale]/actions/draft-orders";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface DraftOrdersTableProps {
  data: DraftOrderRow[];
  onDataChange: () => void;
}

export function DraftOrdersTable({
  data,
  onDataChange,
}: DraftOrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getStatusBadge = (invoiceSent: boolean, paymentStatus: string) => {
    if (paymentStatus === "paid") {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }
    if (invoiceSent) {
      return <Badge className="bg-blue-100 text-blue-800">Invoice sent</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Open</Badge>;
  };

  const handleBulkDelete = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection)
      .map((rowIndex) => {
        const row = table.getRowModel().rows[parseInt(rowIndex)];
        return row?.original.id;
      })
      .filter((id): id is string => !!id);

    if (selectedIds.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteDraftOrders(selectedIds);

      if (result.success) {
        const deletedCount = result.deletedCount || selectedIds.length;
        toast.success(
          `${deletedCount} draft order${deletedCount > 1 ? "s" : ""} deleted successfully`
        );
        setRowSelection({});
        setBulkDeleteConfirm(false);
        onDataChange();
      } else {
        toast.error(result.error || "Failed to delete draft orders");
      }
    } catch (error) {
      toast.error("Failed to delete draft orders");
      console.error("Bulk delete error:", error);
    } finally {
      setDeleting(false);
    }
  }, [rowSelection, onDataChange]);

  const columns = useMemo<ColumnDef<DraftOrderRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const isAllSelected = table.getIsAllPageRowsSelected();
          const isSomeSelected = table.getIsSomePageRowsSelected();
          return (
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) =>
                table.toggleAllPageRowsSelected(!!checked)
              }
              className={!isAllSelected && isSomeSelected ? "opacity-50" : ""}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(!!checked)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "draftNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Draft Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const draftId = row.original.id;
          return (
            <Link
              href={`/dashboard/draft_orders/${draftId}`}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              #{row.original.draftNumber}
            </Link>
          );
        },
      },
      {
        id: "date",
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.original.createdAt;
          return (
            <span className="text-sm">
              {formatDistanceToNow(new Date(date), { addSuffix: true })}
            </span>
          );
        },
      },
      {
        id: "customer",
        accessorFn: (row) =>
          `${row.customerFirstName || ""} ${row.customerLastName || ""}`.trim() ||
          row.customerEmail ||
          "",
        header: "Customer",
        cell: ({ row }) => {
          const name = `${row.original.customerFirstName || ""} ${
            row.original.customerLastName || ""
          }`.trim();
          return (
            <div className="text-sm">
              {name || row.original.customerEmail || "N/A"}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          return getStatusBadge(
            row.original.invoiceSent,
            row.original.paymentStatus
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Total
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.original.totalAmount || "0");
          return (
            <span className="text-sm font-medium">
              {row.original.currency} {amount.toFixed(2)}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    state: {
      sorting,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const selectedRows = table.getRowModel().rows.filter((row) =>
    rowSelection[row.id]
  );
  const selectedDrafts = selectedRows.map((row) => row.original);

  return (
    <div className="space-y-4">
      {/* Bulk Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500 bg-orange-50 px-4 py-3">
          <span className="text-sm font-medium text-orange-900">
            {selectedCount} draft order{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
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
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : bulkDeleteConfirm
                  ? "Confirm Delete"
                  : "Delete"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRowSelection({});
                setBulkDeleteConfirm(false);
              }}
              disabled={deleting}
            >
              Cancel
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
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No draft orders found.
                </TableCell>
              </TableRow>
            ) : (
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
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
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
    </div>
  );
}

