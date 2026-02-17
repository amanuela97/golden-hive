import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import OrdersPageClient from "../components/shared/OrdersPageClient";
import CustomerOrdersPageClient from "./components/CustomerOrdersPageClient";
import { listOrders } from "@/app/[locale]/actions/orders-list";

export default async function OrdersPage() {
  const { role } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller", "customer"],
  });

  // Fetch initial orders - sorted by latest (date, descending)
  const initialResult = await listOrders({
    page: 1,
    pageSize: 50,
    sortBy: "date",
    sortDirection: "desc",
  });

  if (!initialResult.success) {
    return (
      <DashboardWrapper userRole={role}>
        <div className="p-6">
          <div className="text-red-600">
            {initialResult.error || "Failed to load orders"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  // Render customer-specific view for customers
  if (role === "customer") {
    return (
      <DashboardWrapper userRole={role}>
        <CustomerOrdersPageClient
          initialData={initialResult.data || []}
          initialTotalCount={initialResult.totalCount || 0}
        />
      </DashboardWrapper>
    );
  }

  // Render admin/seller view
  return (
    <DashboardWrapper userRole={role}>
      <OrdersPageClient
        initialData={initialResult.data || []}
        initialTotalCount={initialResult.totalCount || 0}
      />
    </DashboardWrapper>
  );
}
