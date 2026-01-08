import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import StoresPageClient from "./StoresPageClient";
import { getAllStores } from "@/app/[locale]/actions/admin-stores";
import DashboardNotFound from "../not-found";

export default async function AdminStoresPage() {
  // Automatically checks route access based on navigation config
  const result = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role } = result;

  const stores = await getAllStores();

  return (
    <DashboardWrapper userRole={role}>
      <StoresPageClient initialStores={stores} />
    </DashboardWrapper>
  );
}
