import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import DashboardNotFound from "../../not-found";
import PayoutsPageClient from "./PayoutsPageClient";
import {
  getBalanceSummary,
  getRecentActivity,
  getPayoutSettings,
} from "@/app/[locale]/actions/finances";
import { getStoreIdForUser } from "@/app/[locale]/actions/orders";
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
  const { storeId } = await getStoreIdForUser();

  if (!storeId) {
    return <DashboardNotFound />;
  }

  // Fetch all data in parallel
  const [balanceResult, activityResult, payoutsResult, settingsResult] =
    await Promise.all([
      getBalanceSummary(),
      getRecentActivity(50, 0),
      getPayouts(storeId),
      getPayoutSettings(),
    ]);

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
