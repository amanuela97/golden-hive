"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { OrdersTable } from "./OrdersTable";
import { listOrders, type OrderRow, type OrderFilters } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";

interface OrdersPageClientProps {
  initialData: OrderRow[];
  initialTotalCount: number;
}

export default function OrdersPageClient({
  initialData,
  initialTotalCount,
}: OrdersPageClientProps) {
  const [data, setData] = useState<OrderRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] =
    useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: OrderFilters = {
        search: debouncedSearch || undefined,
        paymentStatus:
          paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
        fulfillmentStatus:
          fulfillmentStatusFilter !== "all"
            ? fulfillmentStatusFilter
            : undefined,
        page,
        pageSize: 50,
        sortBy: "date",
        sortDirection: "desc",
      };

      const result = await listOrders(filters);
      if (result.success && result.data) {
        setData(result.data);
        setTotalCount(result.totalCount || 0);
      } else {
        toast.error(result.error || "Failed to load orders");
      }
    } catch (error) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, paymentStatusFilter, fulfillmentStatusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDataChange = () => {
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Link href="/dashboard/orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number, customer or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={paymentStatusFilter}
          onValueChange={setPaymentStatusFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_refunded">Partially Refunded</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={fulfillmentStatusFilter}
          onValueChange={setFulfillmentStatusFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fulfillment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fulfillment Status</SelectItem>
            <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">Loading orders...</div>
      ) : (
        <OrdersTable data={data} onDataChange={handleDataChange} />
      )}

      {/* Server-side pagination info */}
      {totalCount > 50 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {data.length} of {totalCount} orders
        </div>
      )}
    </div>
  );
}

