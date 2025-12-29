"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import MarketForm from "../components/MarketForm";
import { updateMarket } from "@/app/[locale]/actions/markets-management";
import toast from "react-hot-toast";

interface MarketFormClientProps {
  initialData: {
    id: string;
    name: string;
    currency: string;
    status: "active" | "draft";
    countries: string[] | null;
    exchangeRate: string;
    roundingRule: string | null;
    isDefault: boolean;
  };
  marketId: string;
}

export default function MarketFormClient({
  initialData,
  marketId,
}: MarketFormClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: {
    name: string;
    currency: string;
    countries: string[];
    roundingRule?: string;
    status?: "active" | "draft";
    isDefault?: boolean;
  }) => {
    setIsLoading(true);
    try {
      const result = await updateMarket(marketId, data);

      if (result.success) {
        toast.success("Market updated successfully");
        router.push("/dashboard/markets");
      } else {
        toast.error(result.error || "Failed to update market");
      }
    } catch (error: unknown) {
      console.error(
        "Update market error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast.error("Failed to update market");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MarketForm
      initialData={initialData}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
}
