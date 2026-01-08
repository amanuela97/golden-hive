import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DiscountsPageClient from "./DiscountsPageClient";
import { getDiscounts } from "../../actions/discounts";
import DashboardNotFound from "../not-found";

export default async function DiscountsPage() {
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

  const isAdmin = roleNameTyped === "admin";

  // Fetch discounts
  const discountsResult = await getDiscounts();
  const discounts = discountsResult.success
    ? discountsResult.discounts || []
    : [];

  return (
    <DashboardWrapper userRole={roleNameTyped}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discounts</h1>
            <p className="text-muted-foreground mt-2">
              {isAdmin
                ? "Manage all discounts across the platform"
                : "Manage your discounts and promotions"}
            </p>
          </div>
        </div>

        <DiscountsPageClient discounts={discounts} isAdmin={isAdmin} />
      </div>
    </DashboardWrapper>
  );
}
