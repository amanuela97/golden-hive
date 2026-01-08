import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { getAllListingsWithUsers } from "@/lib/listing";
import { getListingsByProducer } from "@/lib/listing";
import ProductsPageClient from "../components/shared/ProductsPageClient";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DashboardNotFound from "../not-found";

export default async function ProductsPage() {
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

  const isAdmin = roleName === "admin";

  // Get products based on role
  const products = isAdmin
    ? await getAllListingsWithUsers()
    : await getListingsByProducer(userId);

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {isAdmin ? "All Products" : "Products"}
            </h1>
            <p className="text-gray-600 mt-2">
              {isAdmin
                ? "Manage all products across the platform"
                : "Manage your products and inventory"}
            </p>
          </div>
        </div>

        <ProductsPageClient
          products={products}
          basePath="/dashboard"
          isAdmin={isAdmin}
        />
      </div>
    </DashboardWrapper>
  );
}
