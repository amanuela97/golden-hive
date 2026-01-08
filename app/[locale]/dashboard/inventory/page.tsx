import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import InventoryPageClient from "../components/shared/InventoryPageClient";
import {
  getInventoryRows,
  getStoreLocations,
} from "@/app/[locale]/actions/inventory-management";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../not-found";

export default async function InventoryPage() {
  // Automatically checks route access based on navigation config
  const {
    role: roleName,
    userId,
    locale,
    shouldShowNotFound,
  } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const isAdmin = roleName === "admin";

  // Check if store exists (only required for sellers, not admins)
  if (!isAdmin) {
    const storeResult = await db
      .select({ id: store.id })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, userId))
      .limit(1);

    if (storeResult.length === 0) {
      redirect({ href: "/dashboard/settings/store", locale });
    }
  }

  // Fetch initial data
  const locationsResult = await getStoreLocations();
  const inventoryResult = await getInventoryRows({ page: 1, pageSize: 50 });

  const locations = locationsResult.success ? locationsResult.data || [] : [];
  const inventoryData = inventoryResult.success
    ? inventoryResult.data || []
    : [];
  const totalCount = inventoryResult.totalCount || 0;

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground mt-2">
              Manage your product inventory across locations
            </p>
          </div>
        </div>

        <InventoryPageClient
          initialData={inventoryData}
          initialLocations={locations}
          initialTotalCount={totalCount}
        />
      </div>
    </DashboardWrapper>
  );
}
