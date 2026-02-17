"use client";

import { useState } from "react";
import { BalanceSummary } from "../components/BalanceSummary";
import { RecentActivityFeed } from "../components/RecentActivityFeed";
import { PayoutHistory } from "../components/PayoutHistory";
import { RequestPayoutButton } from "../components/RequestPayoutButton";
import { ActivityFilters } from "../components/ActivityFilters";
import { ExportButton } from "../components/ExportButton";
import { PayoutScheduleSettings } from "../components/PayoutScheduleSettings";
import { PayoutScheduleInfo } from "../components/PayoutScheduleInfo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/utils";
import {
  getRecentActivity,
  getBalanceSummary,
  type WalletSummary,
} from "@/app/[locale]/actions/finances";

interface BalanceData {
  wallets: { EUR: WalletSummary; NPR: WalletSummary };
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
  schedule?: "daily" | "weekly" | "biweekly" | "monthly" | null;
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
  balanceData: initialBalanceData,
  activities: initialActivities,
  payouts: initialPayouts,
  payoutSettings,
}: PayoutsPageClientProps) {
  const router = useRouter();
  const [balanceData, setBalanceData] = useState(initialBalanceData);
  const [activities, setActivities] = useState(initialActivities);
  const [payouts] = useState(initialPayouts);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }>({});

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Refresh all data
      const [balanceResult, activityResult] = await Promise.all([
        getBalanceSummary(),
        getRecentActivity(50, 0, filters),
      ]);

      if (balanceResult.success && balanceResult.data) {
        setBalanceData(balanceResult.data);
      }

      if (activityResult.success && activityResult.data) {
        setActivities(activityResult.data);
      }

      // Trigger router refresh to update server components (including payouts)
      router.refresh();
    } catch (error) {
      console.error("Error refreshing data:", error);
      // Fallback to router refresh
      router.refresh();
    } finally {
      setIsLoading(false);
    }
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

  if (!balanceData?.wallets) {
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

  const { wallets } = balanceData;
  const minimumAmount = payoutSettings?.minimumAmount || 20.0;

  const effectiveEur =
    wallets.EUR.stripeConnectedAvailable !== null
      ? Math.min(wallets.EUR.availableBalance, wallets.EUR.stripeConnectedAvailable)
      : wallets.EUR.availableBalance;
  const fundsSettlingEur =
    wallets.EUR.availableBalance > 0 &&
    wallets.EUR.stripeConnectedAvailable !== null &&
    wallets.EUR.stripeConnectedAvailable === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance & Payouts</h1>
          <p className="text-muted-foreground mt-2">
            Manage your earnings and request payouts. EUR → Stripe; NPR → eSewa.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-medium">
            Available balance: {formatCurrency(wallets.EUR.availableBalance, "EUR")} · {formatCurrency(wallets.NPR.availableBalance, "NPR")}
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestPayoutButton
              availableBalance={effectiveEur}
              currency="EUR"
              minimumAmount={minimumAmount}
              onSuccess={handleRefresh}
              payoutMethodLabel="Stripe"
            />
            <RequestPayoutButton
              availableBalance={wallets.NPR.availableBalance}
              currency="NPR"
              minimumAmount={minimumAmount}
              onSuccess={handleRefresh}
              payoutMethodLabel="eSewa (Nepal)"
            />
          </div>
          {fundsSettlingEur && (
            <p className="text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              Your EUR funds are settling. They usually become available within 2–7 business days.
            </p>
          )}
        </div>
      </div>
      <BalanceSummary
        wallets={wallets}
        holdPeriodDays={payoutSettings?.holdPeriodDays}
      />

      {/* Payout Schedule Info (Stripe/EUR) */}
      {payoutSettings && (
        <PayoutScheduleInfo
          nextPayoutAt={payoutSettings.nextPayoutAt || null}
          lastPayoutAt={wallets.EUR.lastPayoutAt}
          lastPayoutAmount={wallets.EUR.lastPayoutAmount}
          schedule={payoutSettings.schedule || null}
          currency="EUR"
        />
      )}

      {/* Payout Schedule Settings */}
      <PayoutScheduleSettings
        currentSettings={payoutSettings}
        onSuccess={handleRefresh}
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
