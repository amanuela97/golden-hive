import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import CreateOrderForm from "../../orders/components/CreateOrderForm";
import DashboardNotFound from "../../not-found";

export default async function NewDraftOrderPage() {
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

  return (
    <DashboardWrapper userRole={roleName}>
      <CreateOrderForm
        userRole={roleName}
        cancelRedirectPath="/dashboard/draft_orders"
      />
    </DashboardWrapper>
  );
}
