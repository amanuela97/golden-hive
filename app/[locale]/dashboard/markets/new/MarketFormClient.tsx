"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import MarketForm from "../components/MarketForm";
import { createMarket } from "@/app/[locale]/actions/markets-management";
import toast from "react-hot-toast";

export default function MarketFormClient() {
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
      const result = await createMarket(data);

      if (result.success) {
        toast.success("Market created successfully");
        router.push("/dashboard/markets");
      } else {
        toast.error(result.error || "Failed to create market");
      }
    } catch (error) {
      console.error("Create market error:", error);
      toast.error("Failed to create market");
    } finally {
      setIsLoading(false);
    }
  };

  return <MarketForm onSubmit={handleSubmit} isLoading={isLoading} />;
}

