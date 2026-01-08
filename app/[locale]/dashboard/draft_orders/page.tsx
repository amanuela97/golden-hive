import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DraftOrdersPageClient from "./DraftOrdersPageClient";
import { listDraftOrders } from "@/app/[locale]/actions/draft-orders";
import DashboardNotFound from "../not-found";

export default async function DraftOrdersPage() {
  // Automatically checks route access based on navigation config
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

  // Fetch initial draft orders
  const initialResult = await listDraftOrders({
    selectedView: "all",
    page: 1,
    pageSize: 50,
  });

  if (!initialResult.success) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="p-6">
          <div className="text-red-600">
            {initialResult.error || "Failed to load draft orders"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <DraftOrdersPageClient
        initialData={initialResult.data || []}
        initialTotalCount={initialResult.totalCount || 0}
      />
    </DashboardWrapper>
  );
}
