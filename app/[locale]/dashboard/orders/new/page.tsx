import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import CreateOrderForm from "../components/CreateOrderForm";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export default async function CreateOrderPage() {
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

  const { role } = result;

  return (
    <DashboardWrapper userRole={role}>
      <CreateOrderForm userRole={role} />
    </DashboardWrapper>
  );
}
