"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type Vendor = {
  id: string;
  name: string;
};

interface VendorSelectProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  vendors: Vendor[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function VendorSelect({
  value,
  onValueChange,
  vendors,
  placeholder = "Select a vendor (optional)",
  disabled = false,
  id,
}: VendorSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Find vendor by id
  const selectedVendor = vendors.find((vendor) => vendor.id === value);

  const filteredVendors = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return []; // Don't show vendors until user starts searching
    }
    const search = searchTerm.toLowerCase();
    return vendors.filter((vendor) =>
      vendor.name.toLowerCase().includes(search)
    );
  }, [searchTerm, vendors]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedVendor ? selectedVendor.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-auto p-1">
          {!searchTerm.trim() ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Start typing to search vendors...
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onValueChange(null);
                  setOpen(false);
                  setSearchTerm("");
                }}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  !value && "bg-accent text-accent-foreground"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                No vendor (Global)
              </button>
              {filteredVendors.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No vendors found.
                </div>
              ) : (
                filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => {
                      onValueChange(vendor.id);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      value === vendor.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === vendor.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {vendor.name}
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

