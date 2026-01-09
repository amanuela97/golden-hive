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
  const { storeId } = await getStoreIdForUser();

  if (!storeId) {
    return <DashboardNotFound />;
  }

  const activityResult = await getRecentActivity(100, 0);

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
