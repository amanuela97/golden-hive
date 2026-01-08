import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import { listRefundRequests } from "@/app/[locale]/actions/refund-requests";
import RefundRequestsPageClient from "./RefundRequestsPageClient";
import DashboardNotFound from "../../not-found";

export default async function RefundRequestsPage() {
  const { role, shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const result = await listRefundRequests();

  if (!result.success) {
    return (
      <DashboardWrapper userRole={role}>
        <div className="p-6">
          <div className="text-red-600">
            {result.error || "Failed to load refund requests"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={role}>
      <RefundRequestsPageClient initialData={result.data || []} />
    </DashboardWrapper>
  );
}
