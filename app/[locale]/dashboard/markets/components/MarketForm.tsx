"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { getExchangeRate } from "@/app/[locale]/actions/markets-management";
import toast from "react-hot-toast";
import countriesData from "@/data/countries.json";
import currencyData from "@/data/currency/currency.json";
import Select from "react-select";

type Country = {
  value: string;
  label: string;
};

type Currency = {
  code: string;
  name: string;
  symbol: string;
};

interface MarketFormProps {
  initialData?: {
    id: string;
    name: string;
    currency: string;
    status: "active" | "draft";
    countries: string[] | null;
    exchangeRate: string;
    roundingRule: string | null;
    isDefault: boolean;
  };
  onSubmit: (data: {
    name: string;
    currency: string;
    countries: string[];
    roundingRule?: string;
    status?: "active" | "draft";
    isDefault?: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export default function MarketForm({
  initialData,
  onSubmit,
  isLoading = false,
}: MarketFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [currency, setCurrency] = useState(initialData?.currency || "");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    initialData?.countries || []
  );
  const [status, setStatus] = useState<"active" | "draft">(
    initialData?.status || "active"
  );
  const [roundingRule, setRoundingRule] = useState(
    initialData?.roundingRule || "none"
  );
  const [isDefault, setIsDefault] = useState(initialData?.isDefault || false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(
    initialData?.exchangeRate || "1"
  );

  const countries = countriesData as Country[];
  const currencies = currencyData as Currency[];

  // Fetch exchange rate when currency changes
  useEffect(() => {
    if (currency && (!initialData || currency !== initialData.currency)) {
      setFetchingRate(true);
      getExchangeRate(currency, "EUR")
        .then((result) => {
          if (result.success && result.rate) {
            setExchangeRate(String(result.rate));
          } else {
            toast.error(result.error || "Failed to fetch exchange rate");
          }
        })
        .catch((error) => {
          console.error("Error fetching exchange rate:", error);
          toast.error("Failed to fetch exchange rate");
        })
        .finally(() => {
          setFetchingRate(false);
        });
    }
  }, [currency, initialData]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a market name");
      return;
    }

    if (!currency) {
      toast.error("Please select a currency");
      return;
    }

    if (selectedCountries.length === 0) {
      toast.error("Please select at least one country");
      return;
    }

    await onSubmit({
      name: name.trim(),
      currency,
      countries: selectedCountries,
      roundingRule: roundingRule || "none",
      status,
      isDefault,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Market Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Europe, United States"
              required
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency *</Label>
            <ShadcnSelect value={currency} onValueChange={setCurrency} required>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name} ({curr.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </ShadcnSelect>
          </div>

          {currency && (
            <div>
              <Label>Exchange Rate (to EUR)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={exchangeRate}
                  readOnly
                  className="bg-muted"
                />
                {fetchingRate && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically fetched from exchange rate API
              </p>
            </div>
          )}

          <div>
            <Label>Countries *</Label>
            <Select
              isMulti
              options={countries}
              value={countries.filter((country) =>
                selectedCountries.includes(country.value)
              )}
              onChange={(selected) => {
                setSelectedCountries(
                  selected ? selected.map((option) => option.value) : []
                );
              }}
              placeholder="Select countries..."
              isSearchable
              className="react-select-container"
              classNamePrefix="react-select"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "42px",
                  borderColor: "hsl(var(--input))",
                  "&:hover": {
                    borderColor: "hsl(var(--input))",
                  },
                }),
                multiValue: (base) => ({
                  ...base,
                  backgroundColor: "hsl(var(--secondary))",
                }),
                multiValueLabel: (base) => ({
                  ...base,
                  color: "hsl(var(--secondary-foreground))",
                }),
                multiValueRemove: (base) => ({
                  ...base,
                  color: "hsl(var(--secondary-foreground))",
                  "&:hover": {
                    backgroundColor: "hsl(var(--destructive))",
                    color: "hsl(var(--destructive-foreground))",
                  },
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
            />
            <p className="text-sm text-muted-foreground mt-2">
              {selectedCountries.length} country{selectedCountries.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <ShadcnSelect
              value={status}
              onValueChange={(value) => setStatus(value as "active" | "draft")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </ShadcnSelect>
          </div>

          <div>
            <Label htmlFor="roundingRule">Rounding Rule</Label>
            <ShadcnSelect
              value={roundingRule}
              onValueChange={setRoundingRule}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="0.99">0.99</SelectItem>
                <SelectItem value="nearest_0.05">Nearest 0.05</SelectItem>
              </SelectContent>
            </ShadcnSelect>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default market
            </Label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isLoading || fetchingRate}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Market"
          )}
        </Button>
      </div>
    </form>
  );
}

