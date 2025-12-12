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
import countriesData from "@/data/countries.json";

type Country = {
  value: string;
  label: string;
};

interface CountrySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function CountrySelect({
  value,
  onValueChange,
  placeholder = "Select a country",
  disabled = false,
  id,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const countries = countriesData as Country[];

  // Find country by value (code) or by label (full name) to support both formats
  const selectedCountry = countries.find(
    (country) => country.value === value || country.label === value
  );

  const filteredCountries = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return countries;
    }
    const search = searchTerm.toLowerCase();
    return countries.filter(
      (country) =>
        country.label.toLowerCase().includes(search) ||
        country.value.toLowerCase().includes(search)
    );
  }, [searchTerm, countries]);

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
          {selectedCountry ? selectedCountry.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-auto p-1">
          {filteredCountries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No countries found.
            </div>
          ) : (
            filteredCountries.map((country) => (
              <button
                key={country.value}
                type="button"
                onClick={() => {
                  onValueChange(country.value);
                  setOpen(false);
                  setSearchTerm("");
                }}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  value === country.value && "bg-accent text-accent-foreground"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === country.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {country.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

