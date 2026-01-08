import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import { CustomerForm } from "@/app/[locale]/dashboard/components/shared/CustomerForm";
import { getStoresForFilter } from "@/app/[locale]/actions/customers";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export default async function NewCustomerPage() {
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

  const { role: roleName, userId } = result;

  // Check if store exists (only required for sellers, not admins)
  if (roleName !== "admin") {
    const storeResult = await db
      .select({ id: store.id })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, userId))
      .limit(1);

    if (storeResult.length === 0) {
      // User doesn't have store setup, but we'll still show the page
      // They just won't see any customers until they set up a store
    }
  }

  const storesResult = await getStoresForFilter();
  const isAdmin = storesResult.success;

  return (
    <DashboardWrapper userRole={roleName}>
      <CustomerForm isEdit={false} isAdmin={isAdmin} />
    </DashboardWrapper>
  );
}
