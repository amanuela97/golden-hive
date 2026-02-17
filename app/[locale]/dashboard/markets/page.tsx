import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import MarketsPageClient from "./MarketsPageClient";
import { listMarkets } from "@/app/[locale]/actions/markets-management";
import DashboardNotFound from "../not-found";

export default async function MarketsPage() {
  const result = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName } = result;

  // Fetch initial markets data (only user's own markets)
  const marketsResult = await listMarkets();

  return (
    <DashboardWrapper userRole={roleName}>
      <MarketsPageClient
        initialData={marketsResult.data || []}
        userRole={roleName}
      />
    </DashboardWrapper>
  );
}
