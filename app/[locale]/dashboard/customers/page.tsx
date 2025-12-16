import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import {
  listCustomers,
  getStoresForFilter,
} from "@/app/[locale]/actions/customers";
import CustomersPageClient from "@/app/[locale]/dashboard/components/shared/CustomersPageClient";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function CustomersPage() {
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

  // Only admin and seller can access customers
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  // Check if store exists (only required for sellers, not admins)
  if (roleName !== "admin") {
    const storeResult = await db
      .select({ id: store.id })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, session?.user.id ?? ""))
      .limit(1);

    if (storeResult.length === 0) {
      // User doesn't have store setup, but we'll still show the page
      // They just won't see any customers until they set up a store
    }
  }

  // Fetch initial data
  const initialResult = await listCustomers({
    page: 0,
    pageSize: 20,
  });

  // Check if user is admin
  const storesResult = await getStoresForFilter();
  const isAdmin = storesResult.success;
  const stores =
    storesResult.success && storesResult.data ? storesResult.data : [];

  if (!initialResult.success) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="p-6">
          <div className="text-red-600">
            {initialResult.error || "Failed to load customers"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground mt-1">
              Manage your customers and their orders
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        </div>

        <CustomersPageClient
          initialData={
            initialResult.success && initialResult.data
              ? initialResult.data
              : []
          }
          initialTotalCount={initialResult.totalCount || 0}
          initialIsAdmin={isAdmin}
          initialStores={stores}
        />
      </div>
    </DashboardWrapper>
  );
}
