import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import DashboardNotFound from "../../not-found";
import TransactionsPageClient from "./TransactionsPageClient";
import { getRecentActivity } from "@/app/[locale]/actions/finances";
import { getStoreIdForUser } from "@/app/[locale]/actions/orders";

export default async function TransactionsPage() {
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

  const activityResult = storeId
    ? await getRecentActivity(100, 0)
    : { success: false as const, data: [] as const };

  return (
    <DashboardWrapper userRole={roleName}>
      <TransactionsPageClient
        initialActivities={
          activityResult.success && activityResult.data
            ? activityResult.data
            : []
        }
      />
    </DashboardWrapper>
  );
}
