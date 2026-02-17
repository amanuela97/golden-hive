"use client";

import React, { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
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
import { ArrowUpDown, X, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CancelOrderModal } from "./CancelOrderModal";
import { RefundRequestForm } from "./RefundRequestForm";

function CancelOrderButton({
  orderId,
  orderNumber,
  totalAmount,
  currency,
  fulfillmentStatus,
  onSuccess,
}: {
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  fulfillmentStatus: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <X className="mr-1 h-3 w-3" />
        Cancel
      </Button>
      <CancelOrderModal
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        orderNumber={orderNumber}
        totalAmount={totalAmount}
        currency={currency}
        fulfillmentStatus={fulfillmentStatus}
        onSuccess={onSuccess}
      />
    </>
  );
}

function RefundRequestButton({
  orderId,
  orderNumber,
  totalAmount,
  currency,
  onSuccess,
}: {
  orderId: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="mr-1 h-3 w-3" />
        Refund
      </Button>
      <RefundRequestForm
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        orderNumber={orderNumber}
        totalAmount={totalAmount}
        currency={currency}
        onSuccess={onSuccess}
      />
    </>
  );
}

interface CustomerOrdersTableProps {
  data: OrderRow[];
  onDataChange: () => void;
}

export function CustomerOrdersTable({
  data,
  onDataChange,
}: CustomerOrdersTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "date", desc: true }, // Sort by date, latest first
  ]);

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      paid: "bg-green-100 text-green-800 border-green-200",
      partially_refunded: "bg-orange-100 text-orange-800 border-orange-200",
      refunded: "bg-red-100 text-red-800 border-red-200",
      failed: "bg-red-100 text-red-800 border-red-200",
      void: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[status] || colors.pending;
  };

  const getFulfillmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unfulfilled: "bg-yellow-100 text-yellow-800 border-yellow-200",
      partial: "bg-orange-100 text-orange-800 border-orange-200",
      fulfilled: "bg-green-100 text-green-800 border-green-200",
      canceled: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || colors.unfulfilled;
  };

  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-100 text-blue-800 border-blue-200",
      draft: "bg-gray-100 text-gray-800 border-gray-200",
      archived: "bg-purple-100 text-purple-800 border-purple-200",
      canceled: "bg-red-100 text-red-800 border-red-200",
      completed: "bg-green-100 text-green-800 border-green-200",
    };
    return colors[status] || colors.draft;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      paid: "Paid",
      partially_refunded: "Partially Refunded",
      refunded: "Refunded",
      failed: "Failed",
      void: "Void",
    };
    return labels[status] || status;
  };

  const getFulfillmentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      unfulfilled: "Unfulfilled",
      partial: "Partial",
      fulfilled: "Fulfilled",
      canceled: "Canceled",
    };
    return labels[status] || status;
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: "Open",
      draft: "Draft",
      archived: "Archived",
      canceled: "Canceled",
      completed: "Completed",
    };
    return labels[status] || status;
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
            Order #
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const orderNumber = row.original.orderNumber;
          return (
            <Link
              href={`/dashboard/orders/${row.original.id}`}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {orderNumber}
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
        accessorKey: "storeName",
        header: "Store",
        cell: ({ row }) => {
          const storeName = row.original.storeName;
          return <div className="text-sm">{storeName || "N/A"}</div>;
        },
      },
      {
        accessorKey: "itemsCount",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.itemsCount} item
            {row.original.itemsCount !== 1 ? "s" : ""}
          </span>
        ),
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
            <Badge variant="outline" className={getPaymentStatusColor(status)}>
              {getPaymentStatusLabel(status)}
            </Badge>
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
          return (
            <Badge
              variant="outline"
              className={getFulfillmentStatusColor(status)}
            >
              {getFulfillmentStatusLabel(status)}
            </Badge>
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
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant="outline" className={getOrderStatusColor(status)}>
              {getOrderStatusLabel(status)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const order = row.original;
          const canCancel =
            (order.status === "open" || order.status === "draft") &&
            (order.fulfillmentStatus === "unfulfilled" ||
              order.fulfillmentStatus === "partial");
          const canRequestRefund =
            order.status === "open" &&
            (order.fulfillmentStatus === "fulfilled" ||
              order.fulfillmentStatus === "partial") &&
            (order.paymentStatus === "paid" ||
              order.paymentStatus === "partially_refunded") &&
            order.refundRequestStatus !== "pending" &&
            order.refundRequestStatus !== "approved" &&
            order.refundRequestStatus !== "rejected";

          const isRefundRequestRejected =
            order.refundRequestStatus === "rejected";

          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/orders/${order.id}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
                {(canCancel || canRequestRefund) && (
                  <span className="text-xs text-muted-foreground">|</span>
                )}
                {canCancel && (
                  <CancelOrderButton
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    totalAmount={order.totalAmount}
                    currency={order.currency}
                    fulfillmentStatus={order.fulfillmentStatus}
                    onSuccess={onDataChange}
                  />
                )}
                {canRequestRefund && (
                  <RefundRequestButton
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    totalAmount={order.totalAmount}
                    currency={order.currency}
                    onSuccess={onDataChange}
                  />
                )}
              </div>
              {isRefundRequestRejected && order.refundRequestReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs">
                  <p className="font-medium text-red-800">
                    Refund Request Rejected
                  </p>
                  <p className="text-red-700 mt-0.5">
                    {order.refundRequestReason}
                  </p>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [onDataChange]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No orders found.</p>
      </div>
    );
  }

  return (
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
