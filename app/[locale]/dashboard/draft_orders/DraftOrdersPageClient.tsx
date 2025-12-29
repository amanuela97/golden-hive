"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { DraftOrdersTable } from "./DraftOrdersTable";
import {
  listDraftOrders,
  type DraftOrderRow,
  type DraftOrderFilters,
} from "@/app/[locale]/actions/draft-orders";
import toast from "react-hot-toast";

interface DraftOrdersPageClientProps {
  initialData: DraftOrderRow[];
  initialTotalCount: number;
}

export default function DraftOrdersPageClient({
  initialData,
  initialTotalCount,
}: DraftOrdersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DraftOrderRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Get active view from URL params, default to "all"
  const activeView =
    (searchParams.get("selectedView") as
      | "all"
      | "open_and_invoice_sent"
      | "open"
      | "invoice_sent"
      | "completed") || "all";

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Handle view change - update URL params
  const handleViewChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("selectedView");
    } else {
      params.set("selectedView", value);
    }
    router.push(`${pathname}?${params.toString()}`);
    setPage(1);
  };

  // Build filters based on active view
  const buildFilters = useCallback((): DraftOrderFilters => {
    const filters: DraftOrderFilters = {
      selectedView: activeView,
      search: debouncedSearch || undefined,
      page,
      pageSize: 50,
    };

    return filters;
  }, [activeView, debouncedSearch, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const result = await listDraftOrders(filters);
      if (result.success && result.data) {
        setData(result.data);
        setTotalCount(result.totalCount || 0);
      } else {
        toast.error(result.error || "Failed to load draft orders");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load draft orders"
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
        <h1 className="text-3xl font-bold">Draft Orders</h1>
        <Button onClick={() => router.push("/dashboard/draft_orders/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Create draft order
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeView} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open_and_invoice_sent">
            Open and invoice sent
          </TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="invoice_sent">Invoice sent</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by draft number, customer or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">Loading draft orders...</div>
      ) : (
        <DraftOrdersTable data={data} onDataChange={handleDataChange} />
      )}

      {/* Server-side pagination info */}
      {totalCount > 50 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {data.length} of {totalCount} draft orders
        </div>
      )}
    </div>
  );
}
