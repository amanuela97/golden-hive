"use client";

import React, { useState, useMemo } from "react";
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
import type { OrderRow } from "@/app/[locale]/actions/orders";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import {
  updatePaymentStatus,
  updateFulfillmentStatus,
} from "@/app/[locale]/actions/orders";

interface OrdersTableProps {
  data: OrderRow[];
  onDataChange: () => void;
}

export function OrdersTable({ data, onDataChange }: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "orderNumber", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handlePaymentStatusChange = async (
    orderId: string,
    newStatus: "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | "void"
  ) => {
    setUpdatingStatus(orderId);
    try {
      const result = await updatePaymentStatus(orderId, newStatus);
      if (result.success) {
        toast.success("Payment status updated");
        onDataChange();
      } else {
        toast.error(result.error || "Failed to update payment status");
      }
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleFulfillmentStatusChange = async (
    orderId: string,
    newStatus: "unfulfilled" | "partial" | "fulfilled" | "canceled" | "on_hold"
  ) => {
    setUpdatingStatus(orderId);
    try {
      const result = await updateFulfillmentStatus(orderId, newStatus);
      if (result.success) {
        toast.success("Fulfillment status updated");
        onDataChange();
      } else {
        toast.error(result.error || "Failed to update fulfillment status");
      }
    } catch (error) {
      toast.error("Failed to update fulfillment status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const paymentStatusOptions = [
    { value: "pending", label: "Pending" },
    { value: "paid", label: "Paid" },
    { value: "partially_refunded", label: "Partially Refunded" },
    { value: "refunded", label: "Refunded" },
    { value: "failed", label: "Failed" },
    { value: "void", label: "Void" },
  ];

  const fulfillmentStatusOptions = [
    { value: "unfulfilled", label: "Unfulfilled" },
    { value: "partial", label: "Partial" },
    { value: "fulfilled", label: "Fulfilled" },
    { value: "canceled", label: "Canceled" },
    { value: "on_hold", label: "On Hold" },
  ];

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
      on_hold: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.unfulfilled;
  };

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        accessorKey: "orderNumber",
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
        cell: ({ row }) => (
          <Link
            href={`/dashboard/orders/${row.original.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            #{row.original.orderNumber}
          </Link>
        ),
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
          const isUpdating = updatingStatus === row.original.id;
          return (
            <Select
              value={status}
              onValueChange={(value) =>
                handlePaymentStatusChange(
                  row.original.id,
                  value as typeof status
                )
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(
                      status
                    )}`}
                  >
                    {paymentStatusOptions.find((opt) => opt.value === status)
                      ?.label || status}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {paymentStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          const isUpdating = updatingStatus === row.original.id;
          return (
            <Select
              value={status}
              onValueChange={(value) =>
                handleFulfillmentStatusChange(
                  row.original.id,
                  value as typeof status
                )
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${getFulfillmentStatusColor(
                      status
                    )}`}
                  >
                    {fulfillmentStatusOptions.find((opt) => opt.value === status)
                      ?.label || status}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fulfillmentStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "itemsCount",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.itemsCount}</span>
        ),
      },
    ],
    [updatingStatus, handlePaymentStatusChange, handleFulfillmentStatusChange]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
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

  return (
    <div className="space-y-4">
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

