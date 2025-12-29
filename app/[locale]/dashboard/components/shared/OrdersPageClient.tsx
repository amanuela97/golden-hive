"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Download } from "lucide-react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { OrdersTable } from "./OrdersTable";
import {
  listOrders,
  type OrderRow,
  type OrderFilters,
} from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";

interface OrdersPageClientProps {
  initialData: OrderRow[];
  initialTotalCount: number;
}

export default function OrdersPageClient({
  initialData,
  initialTotalCount,
}: OrdersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<OrderRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  // Build filters based on active tab
  const buildFilters = useCallback((): OrderFilters => {
    const filters: OrderFilters = {
      search: debouncedSearch || undefined,
      page,
      pageSize: 50,
      sortBy: "date",
      sortDirection: "desc",
    };

    // Apply tab-based filters
    switch (activeTab) {
      case "unfulfilled":
        filters.fulfillmentStatus = "unfulfilled";
        break;
      case "unpaid":
        filters.paymentStatus = "pending"; // Show unpaid (pending) orders
        break;
      case "open":
        filters.status = "open";
        break;
      case "archived":
        filters.archived = true;
        break;
      default:
        // "all" - no additional filters
        break;
    }

    return filters;
  }, [activeTab, debouncedSearch, page]);

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
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Import orders</DropdownMenuItem>
              <DropdownMenuItem>View archived orders</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/dashboard/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unfulfilled">Unfulfilled</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
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
