"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomersTable } from "./CustomersTable";
import { listCustomers, getVendorsForFilter } from "@/app/[locale]/actions/customers";
import type { CustomerRow } from "@/app/[locale]/actions/customers";
import toast from "react-hot-toast";
import { Search } from "lucide-react";

interface CustomersPageClientProps {
  initialData: CustomerRow[];
  initialTotalCount: number;
  initialIsAdmin: boolean;
  initialVendors?: Array<{ id: string; name: string }>;
}

export default function CustomersPageClient({
  initialData,
  initialTotalCount,
  initialIsAdmin,
  initialVendors = [],
}: CustomersPageClientProps) {
  const [data, setData] = useState<CustomerRow[]>(initialData);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [vendors, setVendors] = useState(initialVendors);

  // Fetch vendors if admin
  useEffect(() => {
    if (initialIsAdmin && vendors.length === 0) {
      getVendorsForFilter().then((result) => {
        if (result.success && result.data) {
          setVendors(result.data);
        }
      });
    }
  }, [initialIsAdmin, vendors.length]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listCustomers({
        search: search || undefined,
        vendorId: vendorFilter !== "all" ? vendorFilter : undefined,
        sortBy,
        sortDirection,
        page,
        pageSize: 20,
      });

      if (result.success && result.data) {
        setData(result.data);
        setTotalCount(result.totalCount || 0);
      } else {
        toast.error(result.error || "Failed to fetch customers");
      }
    } catch (error) {
      toast.error("Failed to fetch customers");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [search, vendorFilter, sortBy, sortDirection, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleDataChange = () => {
    fetchCustomers();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-10"
          />
        </div>

        {initialIsAdmin && (
          <Select
            value={vendorFilter}
            onValueChange={(value) => {
              setVendorFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              <SelectItem value="null">No vendor (Global)</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest customers</SelectItem>
            <SelectItem value="oldest">Oldest customers</SelectItem>
            <SelectItem value="total_spent">Highest total spend</SelectItem>
            <SelectItem value="orders_count">Most orders</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading customers...
        </div>
      ) : (
        <CustomersTable data={data} onDataChange={handleDataChange} />
      )}
    </div>
  );
}

