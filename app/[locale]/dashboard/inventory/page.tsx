import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, vendor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import InventoryPageClient from "../components/shared/InventoryPageClient";
import {
  getInventoryRows,
  getVendorLocations,
} from "@/app/[locale]/actions/inventory-management";

export default async function InventoryPage() {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Get user's role
  const userRole = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session?.user.id ?? ""))
    .limit(1);

  if (userRole.length === 0) {
    redirect({ href: "/onboarding", locale });
  }

  const roleName = userRole[0].roleName.toLowerCase() as
    | "admin"
    | "seller"
    | "customer";

  // Only admin and seller can access inventory
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  const isAdmin = roleName === "admin";

  // Check if vendor exists (only required for sellers, not admins)
  if (!isAdmin) {
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session?.user.id ?? ""))
      .limit(1);

    if (vendorResult.length === 0) {
      redirect({ href: "/dashboard/settings/vendor", locale });
    }
  }

  // Fetch initial data
  const locationsResult = await getVendorLocations();
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
