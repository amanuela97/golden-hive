"use client";

import { useState } from "react";
import { RecentActivityFeed } from "../components/RecentActivityFeed";
import { ActivityFilters } from "../components/ActivityFilters";
import { ExportButton } from "../components/ExportButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRecentActivity } from "@/app/[locale]/actions/finances";

interface ActivityItem {
  id: string;
  date: Date;
  type: string;
  description: string;
  amount: number;
  currency: string;
  balance: number;
  orderId?: string | null;
  status?: string | null;
  availableAt?: Date | null;
}

interface TransactionsPageClientProps {
  initialActivities: ActivityItem[];
}

export default function TransactionsPageClient({
  initialActivities,
}: TransactionsPageClientProps) {
  const [activities, setActivities] = useState(initialActivities);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }>({});

  const handleFilterChange = async (newFilters: {
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }) => {
    setFilters(newFilters);
    setIsLoading(true);
    try {
      const result = await getRecentActivity(100, 0, newFilters);
      if (result.success && result.data) {
        setActivities(result.data);
      }
    } catch (error) {
      console.error("Error filtering activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground mt-2">
            Complete history of all transactions affecting your balance
          </p>
        </div>
        <ExportButton filters={filters} />
      </div>

      <ActivityFilters onFilterChange={handleFilterChange} />

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            View all ledger entries sorted by date (newest first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : (
            <RecentActivityFeed activities={activities} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
