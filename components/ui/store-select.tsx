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

type Store = {
  id: string;
  name: string;
};

interface StoreSelectProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  stores: Store[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function StoreSelect({
  value,
  onValueChange,
  stores,
  placeholder = "Select a store (optional)",
  disabled = false,
  id,
}: StoreSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Find store by id
  const selectedStore = stores.find((store) => store.id === value);

  const filteredStores = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return []; // Don't show stores until user starts searching
    }
    const search = searchTerm.toLowerCase();
    return stores.filter((store) =>
      store.name.toLowerCase().includes(search)
    );
  }, [searchTerm, stores]);

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
          {selectedStore ? selectedStore.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search stores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-auto p-1">
          {!searchTerm.trim() ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Start typing to search stores...
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
                No store (Global)
              </button>
              {filteredStores.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No stores found.
                </div>
              ) : (
                filteredStores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      onValueChange(store.id);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      value === store.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === store.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {store.name}
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

