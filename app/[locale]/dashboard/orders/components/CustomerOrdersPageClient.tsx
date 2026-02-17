"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { CustomerOrdersTable } from "./CustomerOrdersTable";
import {
  listOrders,
  type OrderRow,
  type OrderFilters,
} from "@/app/[locale]/actions/orders-list";
import toast from "react-hot-toast";

interface CustomerOrdersPageClientProps {
  initialData: OrderRow[];
  initialTotalCount: number;
}

export default function CustomerOrdersPageClient({
  initialData,
  initialTotalCount,
}: CustomerOrdersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<OrderRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] =
    useState<string>("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get active tab from URL params, default to "all"
  const activeTab = searchParams.get("tab") || "all";

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Handle tab change - update URL params
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const queryString = params.toString();
    const newPath = queryString ? `${pathname}?${queryString}` : pathname;
    router.push(newPath);
    setPage(1); // Reset to first page on tab change
  };

  // Build filters based on active tab and filters
  const buildFilters = useCallback((): OrderFilters => {
    const filters: OrderFilters = {
      search: debouncedSearch || undefined,
      page,
      pageSize: 50,
      sortBy: sortBy as
        | "date"
        | "orderNumber"
        | "total"
        | "paymentStatus"
        | "fulfillmentStatus",
      sortDirection,
    };

    // Apply tab-based filters
    switch (activeTab) {
      case "unfulfilled":
        filters.fulfillmentStatus = "unfulfilled";
        break;
      case "unpaid":
        filters.paymentStatus = "pending";
        break;
      case "open":
        filters.status = "open";
        break;
      case "completed":
        filters.status = "completed";
        break;
      case "canceled":
        filters.status = "canceled";
        break;
      default:
        // "all" - apply manual filters if set
        if (paymentStatusFilter !== "all") {
          filters.paymentStatus = paymentStatusFilter as
            | "pending"
            | "paid"
            | "partially_refunded"
            | "refunded"
            | "failed"
            | "void";
        }
        if (fulfillmentStatusFilter !== "all") {
          filters.fulfillmentStatus = fulfillmentStatusFilter as
            | "unfulfilled"
            | "partial"
            | "fulfilled"
            | "canceled";
        }
        if (orderStatusFilter !== "all") {
          filters.status = orderStatusFilter as
            | "open"
            | "draft"
            | "archived"
            | "canceled"
            | "completed";
        }
        break;
    }

    return filters;
  }, [
    activeTab,
    debouncedSearch,
    page,
    sortBy,
    sortDirection,
    paymentStatusFilter,
    fulfillmentStatusFilter,
    orderStatusFilter,
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const result = await listOrders(filters);
      if (result.success && result.data) {
        setData(result.data);
        setTotalCount(result.totalCount || 0);
      } else {
        toast.error(result.error || "Failed to load orders");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load orders"
      );
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

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
        <h1 className="text-3xl font-bold">My Orders</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unfulfilled">Unfulfilled</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="canceled">Canceled</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order number, product name, or store name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeTab === "all" && (
          <>
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
                <SelectItem value="partially_refunded">
                  Partially Refunded
                </SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
              </SelectContent>
            </Select>
            <Select
              value={orderStatusFilter}
              onValueChange={setOrderStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="orderNumber">Order Number</SelectItem>
                <SelectItem value="total">Total Amount</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSortDirection(sortDirection === "asc" ? "desc" : "asc");
              }}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </Button>
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">Loading orders...</div>
      ) : (
        <CustomerOrdersTable data={data} onDataChange={handleDataChange} />
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
