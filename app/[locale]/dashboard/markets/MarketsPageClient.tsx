"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useDebounce } from "@/hooks/useDebounce";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import {
  listMarkets,
  deleteMarket,
} from "@/app/[locale]/actions/markets-management";
import toast from "react-hot-toast";

type Market = {
  id: string;
  name: string;
  currency: string;
  status: "active" | "draft";
  countries: string[] | null;
  exchangeRate: string;
  isDefault: boolean;
};

interface MarketsPageClientProps {
  initialData: Market[];
  userRole?: "admin" | "seller" | "customer";
}

export default function MarketsPageClient({
  initialData,
  userRole = "admin",
}: MarketsPageClientProps) {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>(initialData);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  // Both admin and seller can manage markets (their own)
  const canManage = userRole === "admin" || userRole === "seller";

  const performSearch = useCallback(async () => {
    try {
      const result = await listMarkets(debouncedSearch);
      if (result.success && result.data) {
        setMarkets(result.data);
      } else {
        toast.error(result.error || "Failed to search markets");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search markets");
    }
  }, [debouncedSearch]);

  // Search when debounced search changes
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const handleRowClick = (marketId: string) => {
    router.push(`/dashboard/markets/${marketId}`);
  };

  const handleDelete = async (e: React.MouseEvent, marketId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this market?")) {
      return;
    }

    try {
      const result = await deleteMarket(marketId);
      if (result.success) {
        toast.success("Market deleted successfully");
        // Refresh the list
        const refreshResult = await listMarkets(debouncedSearch);
        if (refreshResult.success && refreshResult.data) {
          setMarkets(refreshResult.data);
        }
      } else {
        toast.error(result.error || "Failed to delete market");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete market");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-muted-foreground mt-2">
            Manage your markets and their currencies
          </p>
        </div>
        {canManage && (
          <Button onClick={() => router.push("/dashboard/markets/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Market
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Countries</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Exchange Rate</TableHead>
                <TableHead>Default</TableHead>
                {canManage && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
                {!canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No markets found
                  </TableCell>
                </TableRow>
              ) : (
                markets.map((market) => (
                  <TableRow
                    key={market.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(market.id)}
                  >
                    <TableCell className="font-medium">{market.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          market.status === "active" ? "default" : "secondary"
                        }
                        className={
                          market.status === "active"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-gray-500 hover:bg-gray-600"
                        }
                      >
                        {market.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {market.countries && market.countries.length > 0
                        ? `${market.countries.length} country${
                            market.countries.length > 1 ? "s" : ""
                          }`
                        : "None"}
                    </TableCell>
                    <TableCell>{market.currency}</TableCell>
                    <TableCell>{market.exchangeRate}</TableCell>
                    <TableCell>
                      {market.isDefault && (
                        <Badge variant="outline">Default</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Only show delete button if user has more than one market */}
                        {markets.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(e, market.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    )}
                    {!canManage && <TableCell />}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
