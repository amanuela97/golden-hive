"use client";

import { useState } from "react";
import { BalanceSummary } from "../components/BalanceSummary";
import { RecentActivityFeed } from "../components/RecentActivityFeed";
import { PayoutHistory } from "../components/PayoutHistory";
import { RequestPayoutButton } from "../components/RequestPayoutButton";
import { ActivityFilters } from "../components/ActivityFilters";
import { ExportButton } from "../components/ExportButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { getRecentActivity } from "@/app/[locale]/actions/finances";

interface BalanceData {
  availableBalance: number;
  pendingBalance: number;
  amountDue: number;
  currentBalance: number;
  currency: string;
  lastPayoutAt: Date | null;
  lastPayoutAmount: number | null;
}

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

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripeTransferId?: string | null;
  requestedAt: Date;
  processedAt?: Date | null;
  completedAt?: Date | null;
  failureReason?: string | null;
}

interface PayoutSettings {
  method: "manual" | "automatic";
  schedule?: "weekly" | "biweekly" | "monthly" | null;
  minimumAmount: number;
  payoutDayOfWeek?: number | null;
  payoutDayOfMonth?: number | null;
  holdPeriodDays?: number;
  nextPayoutAt?: Date | null;
}

interface PayoutsPageClientProps {
  balanceData: BalanceData | null;
  activities: ActivityItem[];
  payouts: Payout[];
  payoutSettings: PayoutSettings | null;
}

export default function PayoutsPageClient({
  balanceData,
  activities: initialActivities,
  payouts,
  payoutSettings,
}: PayoutsPageClientProps) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }>({});

  const handleRefresh = () => {
    router.refresh();
  };

  const handleFilterChange = async (newFilters: {
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }) => {
    setFilters(newFilters);
    setIsLoading(true);
    try {
      const result = await getRecentActivity(50, 0, newFilters);
      if (result.success && result.data) {
        setActivities(result.data);
      }
    } catch (error) {
      console.error("Error filtering activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!balanceData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Balance & Payouts</h1>
            <p className="text-muted-foreground mt-2">
              Manage your earnings and request payouts
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Unable to load balance data. Please try again later.
        </div>
      </div>
    );
  }

  const minimumAmount = payoutSettings?.minimumAmount || 20.0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance & Payouts</h1>
          <p className="text-muted-foreground mt-2">
            Manage your earnings and request payouts
          </p>
        </div>
        <RequestPayoutButton
          availableBalance={balanceData.availableBalance}
          currency={balanceData.currency}
          minimumAmount={minimumAmount}
          onSuccess={handleRefresh}
        />
      </div>

      <BalanceSummary
        availableBalance={balanceData.availableBalance}
        pendingBalance={balanceData.pendingBalance}
        amountDue={balanceData.amountDue}
        currentBalance={balanceData.currentBalance}
        currency={balanceData.currency}
      />

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    All transactions affecting your balance
                  </CardDescription>
                </div>
                <ExportButton filters={filters} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActivityFilters onFilterChange={handleFilterChange} />
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <RecentActivityFeed activities={activities} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>
                History of all payout requests and transfers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutHistory payouts={payouts} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
