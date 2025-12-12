import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, vendor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import OrdersPageClient from "../components/shared/OrdersPageClient";
import { listOrders } from "@/app/[locale]/actions/orders";

export default async function OrdersPage() {
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

  // Check if user has vendor (for sellers) or is admin
  if (roleName !== "admin") {
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session?.user.id ?? ""))
      .limit(1);

    if (vendorResult.length === 0) {
      // User doesn't have vendor setup, but we'll still show the page
      // They just won't see any orders until they set up a vendor
    }
  }

  // Fetch initial orders
  const initialResult = await listOrders({
    page: 1,
    pageSize: 50,
    sortBy: "orderNumber",
    sortDirection: "desc",
  });

  if (!initialResult.success) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="p-6">
          <div className="text-red-600">
            {initialResult.error || "Failed to load orders"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <OrdersPageClient
        initialData={initialResult.data || []}
        initialTotalCount={initialResult.totalCount || 0}
      />
    </DashboardWrapper>
  );
}

