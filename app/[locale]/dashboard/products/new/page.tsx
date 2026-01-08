import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import NewProductForm from "./NewProductForm";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import DashboardNotFound from "../../not-found";

export default async function NewProductPage() {
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

  const isAdmin = roleName === "admin";

  return (
    <DashboardWrapper userRole={roleName}>
      <NewProductForm isAdmin={isAdmin} />
    </DashboardWrapper>
  );
}
