import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import DashboardNotFound from "../../not-found";
import PayoutsPageClient from "./PayoutsPageClient";
import {
  getBalanceSummary,
  getRecentActivity,
  getPayoutSettings,
} from "@/app/[locale]/actions/finances";
import { getStoreIdForUser } from "@/app/[locale]/actions/store-id";
import { getPayouts } from "@/app/[locale]/actions/seller-payouts";
export default async function PayoutsPage() {
  const result = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName } = result;
  const { storeId, isAdmin } = await getStoreIdForUser();

  // Sellers need a store; admins have no storeId so we show the page with empty data
  if (!storeId && !isAdmin) {
    return <DashboardNotFound />;
  }

  // Fetch all data in parallel (only when user has a store; admins get empty data)
  const [balanceResult, activityResult, payoutsResult, settingsResult] =
    storeId
      ? await Promise.all([
          getBalanceSummary(),
          getRecentActivity(50, 0),
          getPayouts(storeId),
          getPayoutSettings(),
        ])
      : [
          { success: false as const, data: null },
          { success: false as const, data: [] as const },
          { success: false as const, data: [] as const },
          { success: false as const, data: null },
        ];

  return (
    <DashboardWrapper userRole={roleName}>
      <PayoutsPageClient
        balanceData={
          balanceResult.success && balanceResult.data
            ? balanceResult.data
            : null
        }
        activities={
          activityResult.success && activityResult.data
            ? activityResult.data
            : []
        }
        payouts={
          payoutsResult.success && payoutsResult.data ? payoutsResult.data : []
        }
        payoutSettings={
          settingsResult.success && settingsResult.data
            ? settingsResult.data
            : null
        }
      />
    </DashboardWrapper>
  );
}
