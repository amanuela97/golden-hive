import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import {
  listCustomers,
  getStoresForFilter,
} from "@/app/[locale]/actions/customers";
import CustomersPageClient from "@/app/[locale]/dashboard/components/shared/CustomersPageClient";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import DashboardNotFound from "../not-found";

export default async function CustomersPage() {
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
