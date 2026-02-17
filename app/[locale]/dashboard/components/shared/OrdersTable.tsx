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
import type { OrderRow } from "@/app/[locale]/actions/orders-list";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { archiveOrders, unarchiveOrders } from "@/app/[locale]/actions/orders-archive";
import { Checkbox } from "@/components/ui/checkbox";

interface OrdersTableProps {
  data: OrderRow[];
  onDataChange: () => void;
}

export function OrdersTable({ data, onDataChange }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true }, // Sort by date, latest first
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // Orders cannot be deleted - delete functionality removed
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const paymentStatusOptions = useMemo(
    () => [
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "partially_refunded", label: "Partially Refunded" },
      { value: "refunded", label: "Refunded" },
      { value: "failed", label: "Failed" },
      { value: "void", label: "Void" },
    ],
    []
  );

  const fulfillmentStatusOptions = useMemo(
    () => [
      { value: "unfulfilled", label: "Unfulfilled" },
      { value: "partial", label: "Partial" },
      { value: "fulfilled", label: "Fulfilled" },
      { value: "canceled", label: "Canceled" },
    ],
    []
  );

  const orderStatusOptions = useMemo(
    () => [
      { value: "open", label: "Open" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
      { value: "canceled", label: "Canceled" },
    ],
    []
  );

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      partially_refunded: "bg-orange-100 text-orange-800",
      refunded: "bg-red-100 text-red-800",
      failed: "bg-red-100 text-red-800",
      void: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.pending;
  };

  const getFulfillmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unfulfilled: "bg-yellow-100 text-yellow-800",
      partial: "bg-orange-100 text-orange-800",
      fulfilled: "bg-green-100 text-green-800",
      canceled: "bg-red-100 text-red-800",
    };
    return colors[status] || colors.unfulfilled;
  };

  const getWorkflowStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      in_progress: "bg-blue-100 text-blue-800",
      on_hold: "bg-red-100 text-red-800",
      normal: "bg-gray-100 text-gray-800",
    };
    return colors[status || "normal"] || "";
  };

  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-100 text-blue-800",
      draft: "bg-gray-100 text-gray-800",
      archived: "bg-purple-100 text-purple-800",
      canceled: "bg-red-100 text-red-800",
    };
    return colors[status] || colors.draft;
  };

  const columns = useMemo<ColumnDef<OrderRow>[]>(
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
        id: "warning",
        header: "",
        cell: ({ row }) => {
          const hasWarning =
            row.original.hasAddressWarning || row.original.hasRiskWarning;
          if (!hasWarning) return null;
          return (
            <div className="flex items-center">
              <AlertCircle
                className="h-4 w-4 text-yellow-500"
                aria-label="Warning: Address or risk issue"
              />
            </div>
          );
        },
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          // Show first 8 characters of the order ID for readability
          const orderId = row.original.id;
          const shortId = orderId.slice(0, 8);
          return (
            <Link
              href={`/dashboard/orders/${orderId}`}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
              title={orderId}
            >
              #{shortId}
            </Link>
          );
        },
      },
      {
        id: "date",
        accessorFn: (row) => row.placedAt || row.createdAt,
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
          const date = row.original.placedAt || row.original.createdAt;
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
      {
        accessorKey: "paymentStatus",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Payment
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.paymentStatus;
          return (
            <span
              className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(
                status
              )}`}
            >
              {paymentStatusOptions.find((opt) => opt.value === status)
                ?.label || status}
            </span>
          );
        },
      },
      {
        accessorKey: "fulfillmentStatus",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Fulfillment
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.fulfillmentStatus;
          const workflowStatus = row.original.workflowStatus;
          return (
            <div className="flex flex-col gap-1">
              <span
                className={`px-2 py-1 text-xs rounded-full ${getFulfillmentStatusColor(
                  status
                )}`}
              >
                {fulfillmentStatusOptions.find((opt) => opt.value === status)
                  ?.label || status}
              </span>
              {workflowStatus && workflowStatus !== "normal" && (
                <span
                  className={`px-2 py-1 text-xs rounded-full ${getWorkflowStatusColor(
                    workflowStatus
                  )}`}
                >
                  {workflowStatus === "in_progress"
                    ? "In Progress"
                    : workflowStatus === "on_hold"
                      ? `On Hold${row.original.holdReason ? `: ${row.original.holdReason}` : ""}`
                      : workflowStatus}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Order Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={`px-2 py-1 text-xs rounded-full ${getOrderStatusColor(
                status
              )}`}
            >
              {orderStatusOptions.find((opt) => opt.value === status)?.label ||
                status}
            </span>
          );
        },
      },
      {
        accessorKey: "itemsCount",
        header: "Items",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/orders/${row.original.id}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            {row.original.itemsCount} item
            {row.original.itemsCount !== 1 ? "s" : ""}
          </Link>
        ),
      },
      {
        accessorKey: "shippingMethod",
        header: "Shipping Method",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.shippingMethod || "—"}
          </span>
        ),
      },
    ],
    [paymentStatusOptions, fulfillmentStatusOptions, orderStatusOptions]
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

  // Orders cannot be deleted - delete functionality removed

  const selectedCount = Object.keys(rowSelection).length;
  const selectedRows = table
    .getRowModel()
    .rows.filter((row) => rowSelection[row.id]);
  const selectedOrders = selectedRows.map((row) => row.original);

  // Determine available bulk actions based on selected orders
  const getAvailableBulkActions = useCallback(() => {
    if (selectedOrders.length === 0) return [];

    const actions: Array<{
      label: string;
      action: () => void;
      variant:
        | "default"
        | "destructive"
        | "outline"
        | "secondary"
        | "ghost"
        | "link";
      condition: boolean;
    }> = [];

    // Check if all selected orders are unpaid, not archived, and not canceled
    const allUnpaidNotArchived = selectedOrders.every(
      (order) =>
        order.paymentStatus === "pending" &&
        !order.archivedAt &&
        order.status !== "archived" &&
        order.status !== "canceled"
    );
    if (allUnpaidNotArchived) {
      actions.push({
        label: "Cancel orders",
        action: () => {
          toast.success("Bulk cancel not yet implemented");
        },
        variant: "outline",
        condition: true,
      });
    }

    // Check if all selected orders are paid, unfulfilled, not archived, and not canceled
    const allPaidUnfulfilled = selectedOrders.every(
      (order) =>
        (order.paymentStatus === "paid" ||
          order.paymentStatus === "partially_refunded") &&
        (order.fulfillmentStatus === "unfulfilled" ||
          order.fulfillmentStatus === "partial") &&
        !order.archivedAt &&
        order.status !== "archived" &&
        order.status !== "canceled"
    );
    if (allPaidUnfulfilled) {
      actions.push({
        label: "Mark as fulfilled",
        action: () => {
          toast.success("Bulk fulfill not yet implemented");
        },
        variant: "default",
        condition: true,
      });
    }

    // Check if all selected orders are not archived
    const allNotArchived = selectedOrders.every(
      (order) => !order.archivedAt && order.status !== "archived"
    );
    if (allNotArchived) {
      actions.push({
        label: "Archive",
        action: async () => {
          setBulkActionLoading(true);
          try {
            const orderIds = selectedOrders.map((o) => o.id);
            const result = await archiveOrders(orderIds);
            if (result.success) {
              toast.success(
                `${result.archivedCount || orderIds.length} order${
                  (result.archivedCount || orderIds.length) > 1 ? "s" : ""
                } archived`
              );
              setRowSelection({});
              onDataChange();
            } else {
              toast.error(result.error || "Failed to archive orders");
            }
          } catch (error) {
            toast.error("Failed to archive orders");
          } finally {
            setBulkActionLoading(false);
          }
        },
        variant: "outline",
        condition: true,
      });
    }

    // Check if all selected orders are archived
    const allArchived = selectedOrders.every(
      (order) => order.archivedAt || order.status === "archived"
    );
    if (allArchived) {
      actions.push({
        label: "Unarchive",
        action: async () => {
          setBulkActionLoading(true);
          try {
            const orderIds = selectedOrders.map((o) => o.id);
            const result = await unarchiveOrders(orderIds);
            if (result.success) {
              toast.success(
                `${result.unarchivedCount || orderIds.length} order${
                  (result.unarchivedCount || orderIds.length) > 1 ? "s" : ""
                } unarchived`
              );
              setRowSelection({});
              onDataChange();
            } else {
              toast.error(result.error || "Failed to unarchive orders");
            }
          } catch (error) {
            toast.error("Failed to unarchive orders");
          } finally {
            setBulkActionLoading(false);
          }
        },
        variant: "outline",
        condition: true,
      });
    }

    // Orders cannot be deleted - delete action removed

    return actions;
  }, [selectedOrders, table, onDataChange]);

  const availableActions = getAvailableBulkActions();

  return (
    <div className="space-y-4">
      {/* Bulk Selection Banner */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500 bg-orange-50 px-4 py-3">
          <span className="text-sm font-medium text-orange-900">
            {selectedCount} order{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            {availableActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                size="sm"
                onClick={action.action}
                disabled={bulkActionLoading}
              >
                {action.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRowSelection({});
              }}
              disabled={bulkActionLoading}
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
                  No orders found.
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
