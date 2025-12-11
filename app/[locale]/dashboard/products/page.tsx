import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getAllListingsWithUsers } from "@/lib/listing";
import { getListingsByProducer } from "@/lib/listing";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import AdminProductsPageClient from "../components/shared/AdminProductsPageClient";
import ProductsPageClient from "../components/shared/ProductsPageClient";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";

export default async function ProductsPage() {
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

  // Only admin and seller can access products
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  // Render different content based on role
  if (roleName === "admin") {
    // Get all products with user information
    const products = await getAllListingsWithUsers();

    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">All Products</h1>
              <p className="text-gray-600 mt-2">
                Manage all product listings across the platform
              </p>
            </div>
          </div>

          <AdminProductsPageClient products={products} />
        </div>
      </DashboardWrapper>
    );
  } else {
    // Seller: Get products for the current user (producer)
    const products = await getListingsByProducer(session?.user?.id ?? "");

    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Products</h1>
              <p className="text-gray-600 mt-2">
                Manage your product listings and inventory
              </p>
            </div>
          </div>

          <ProductsPageClient products={products} basePath="/dashboard" />
        </div>
      </DashboardWrapper>
    );
  }
}
