import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { getCustomer, getCustomerOrders, getVendorsForFilter } from "@/app/[locale]/actions/customers";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import CustomerDetailPageClient from "./CustomerDetailPageClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
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

  const { id } = await params;
  
  // Validate customer ID format (should be a valid UUID)
  if (!id || typeof id !== "string" || id.length !== 36) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/customers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Customer Not Found</h2>
                <p className="text-muted-foreground">
                  The customer ID is invalid or incorrect. Please check the customer ID and try again.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  const customerResult = await getCustomer(id);
  const ordersResult = await getCustomerOrders(id);
  const vendorsResult = await getVendorsForFilter();
  const isAdmin = vendorsResult.success;

  // Handle orders loading error gracefully - show customer even if orders fail to load
  if (!ordersResult.success) {
    console.error("Failed to load customer orders:", ordersResult.error);
  }

  if (!customerResult.success || !customerResult.data) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/customers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Customer Not Found</h2>
                <p className="text-muted-foreground">
                  {customerResult.error || "The customer does not exist or you don't have permission to view it."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <CustomerDetailPageClient
        customerData={customerResult.data}
        ordersData={ordersResult.success && ordersResult.data ? ordersResult.data : []}
        isAdmin={isAdmin}
      />
    </DashboardWrapper>
  );
}

