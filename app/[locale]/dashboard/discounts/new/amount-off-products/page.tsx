import { DashboardWrapper } from "../../../components/shared/DashboardWrapper";
import DiscountFormClient from "./DiscountFormClient";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../../not-found";

export default async function NewDiscountPage() {
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

  const { role: roleNameTyped } = result;

  return (
    <DashboardWrapper userRole={roleNameTyped}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create discount</h1>
          <p className="text-muted-foreground mt-2">Amount off products</p>
        </div>

        <DiscountFormClient userRole={roleNameTyped} />
      </div>
    </DashboardWrapper>
  );
}
