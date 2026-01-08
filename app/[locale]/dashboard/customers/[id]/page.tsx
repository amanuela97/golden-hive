import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getCustomer,
  getCustomerOrders,
  getStoresForFilter,
} from "@/app/[locale]/actions/customers";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import CustomerDetailPageClient from "./CustomerDetailPageClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
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
                <h2 className="text-2xl font-semibold mb-2">
                  Customer Not Found
                </h2>
                <p className="text-muted-foreground">
                  The customer ID is invalid or incorrect. Please check the
                  customer ID and try again.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  // Parallelize independent data fetching
  const [customerResult, ordersResult, storesResult] = await Promise.all([
    getCustomer(id),
    getCustomerOrders(id),
    getStoresForFilter(),
  ]);
  const isAdmin = storesResult.success;

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
                <h2 className="text-2xl font-semibold mb-2">
                  Customer Not Found
                </h2>
                <p className="text-muted-foreground">
                  {customerResult.error ||
                    "The customer does not exist or you don't have permission to view it."}
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
        ordersData={
          ordersResult.success && ordersResult.data ? ordersResult.data : []
        }
        isAdmin={isAdmin}
      />
    </DashboardWrapper>
  );
}
