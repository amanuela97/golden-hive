"use client";

import { useState } from "react";
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
import { X } from "lucide-react";

interface ActivityFiltersProps {
  onFilterChange: (filters: {
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }) => void;
}

const transactionTypes = [
  { value: "", label: "All Types" },
  { value: "order_payment", label: "Sale" },
  { value: "platform_fee", label: "Platform Fee" },
  { value: "stripe_fee", label: "Stripe Fee" },
  { value: "shipping_label", label: "Shipping" },
  { value: "refund", label: "Refund" },
  { value: "dispute", label: "Dispute" },
  { value: "payout", label: "Payout" },
  { value: "adjustment", label: "Adjustment" },
];

export function ActivityFilters({ onFilterChange }: ActivityFiltersProps) {
  const [type, setType] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const handleApply = () => {
    onFilterChange({
      type: type || undefined,
      search: search || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  };

  const handleClear = () => {
    setType("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    onFilterChange({});
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Search description or order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {transactionTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dateFrom">Date From</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dateTo">Date To</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleApply}>Apply Filters</Button>
        <Button variant="outline" onClick={handleClear}>
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
