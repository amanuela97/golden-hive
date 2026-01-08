import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getCustomer,
  getStoresForFilter,
} from "@/app/[locale]/actions/customers";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import { CustomerForm } from "@/app/[locale]/dashboard/components/shared/CustomerForm";
import { notFound } from "next/navigation";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../../not-found";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
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
  // Parallelize independent data fetching
  const [customerResult, storesResult] = await Promise.all([
    getCustomer(id),
    getStoresForFilter(),
  ]);
  const isAdmin = storesResult.success;

  if (!customerResult.success || !customerResult.data) {
    notFound();
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <CustomerForm
        initialData={customerResult.data}
        isEdit={true}
        isAdmin={isAdmin}
      />
    </DashboardWrapper>
  );
}
