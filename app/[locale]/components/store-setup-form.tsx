"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createStoreForUser } from "@/app/[locale]/actions/store-setup";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";
import currenciesData from "@/data/currency/currency.json";

type Currency = {
  code: string;
  name: string;
  symbol: string;
};

export default function StoreSetupForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [storeCurrency, setStoreCurrency] = useState("EUR");
  const [unitSystem, setUnitSystem] = useState<
    "Metric system" | "Imperial system"
  >("Metric system");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      toast.error("Store name is required");
      return;
    }

    setLoading(true);
    try {
      const result = await createStoreForUser({
        storeName: storeName.trim(),
        storeCurrency,
        unitSystem,
      });

      if (result.success) {
        toast.success("Store created successfully!");
        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        toast.error(result.error || "Failed to create store");
      }
    } catch (error) {
      console.error("Error creating store:", error);
      toast.error("An error occurred while creating your store");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Your Store</CardTitle>
          <CardDescription>
            Please provide some basic information about your store to get
            started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter your store name"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeCurrency">Store Currency *</Label>
              <Select
                value={storeCurrency}
                onValueChange={setStoreCurrency}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {(currenciesData as Currency[]).map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitSystem">Unit System *</Label>
              <Select
                value={unitSystem}
                onValueChange={(value) =>
                  setUnitSystem(value as "Metric system" | "Imperial system")
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Metric system">Metric system</SelectItem>
                  <SelectItem value="Imperial system">
                    Imperial system
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Store..." : "Create Store"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
