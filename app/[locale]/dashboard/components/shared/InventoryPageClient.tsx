"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { InventoryTable } from "./InventoryTable";
import {
  getInventoryRows,
  type InventoryRow,
} from "@/app/[locale]/actions/inventory-management";
import toast from "react-hot-toast";
import { useCurrencyConversion } from "./useCurrencyConversion";

interface InventoryPageClientProps {
  initialData: InventoryRow[];
  initialLocations: Array<{ id: string; name: string }>;
  initialTotalCount: number;
}

export default function InventoryPageClient({
  initialData,
  initialLocations,
  initialTotalCount,
}: InventoryPageClientProps) {
  const [data, setData] = useState<InventoryRow[]>(initialData);
  const [locations] = useState(initialLocations);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>("EUR");
  const pageSize = 50;
  const { convertCurrency, rates } = useCurrencyConversion();

  const totalPages = Math.ceil(totalCount / pageSize);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const result = await getInventoryRows({
      locationId: selectedLocation === "all" ? undefined : selectedLocation,
      search: search || undefined,
      page,
      pageSize,
    });

    if (result.success && result.data) {
      setData(result.data);
      setTotalCount(result.totalCount || 0);
    } else {
      toast.error(result.error || "Failed to fetch inventory");
      setData([]);
    }

    setLoading(false);
  }, [selectedLocation, search, page]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch data when filters or page change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDataChange = () => {
    // Refetch data after updates
    fetchData();
  };

  // Calculate totals
  const totalAvailable = data.reduce((sum, row) => sum + row.available, 0);

  // Calculate total value with currency conversion
  const totalValue = data.reduce((sum, row) => {
    // Calculate on hand for this row
    const onHand = row.available + row.committed + row.incoming;
    const costPerItem = parseFloat(row.costPerItem || "0");
    const variantPrice = parseFloat(row.variantPrice || "0");

    // If cost_per_item is not zero, calculate: (price * onHand) - (costPerItem * onHand)
    // Otherwise, use price * onHand
    const valueInRowCurrency =
      costPerItem > 0
        ? variantPrice * onHand - costPerItem * onHand
        : variantPrice * onHand;

    // Convert directly from row currency to display currency
    const valueInDisplayCurrency = convertCurrency(
      valueInRowCurrency,
      row.currency,
      displayCurrency
    );
    return sum + valueInDisplayCurrency;
  }, 0);

  // Get unique currencies from data
  const availableCurrencies = Array.from(
    new Set(data.map((row) => row.currency))
  ).sort();
  const allCurrencies = Array.from(
    new Set([...availableCurrencies, ...Object.keys(rates)])
  ).sort();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Items</div>
          <div className="text-2xl font-bold mt-1">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">
            Total Available (Current Page)
          </div>
          <div className="text-2xl font-bold mt-1">{totalAvailable}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Inventory Value (Current Page)
            </div>
            <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCurrencies.map((curr) => (
                  <SelectItem key={curr} value={curr}>
                    {curr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-2xl font-bold">
            {displayCurrency} {totalValue.toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by product, variant, or SKU"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <Label htmlFor="location">Location</Label>
            <Select
              value={selectedLocation}
              onValueChange={(value) => {
                setSelectedLocation(value);
                setPage(1); // Reset to first page
              }}
            >
              <SelectTrigger id="location" className="mt-2">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading inventory...
          </div>
        ) : (
          <>
            <InventoryTable data={data} onDataChange={handleDataChange} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, totalCount)} of {totalCount} items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
