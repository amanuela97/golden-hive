import { redirect } from "@/i18n/navigation";
import { getListingById, getListingVariantsWithInventory } from "@/lib/listing";
import { notFound } from "next/navigation";
import EditProductForm from "./EditProductForm";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { role: roleName, userId, locale } = result;

  const { id } = await params;

  // Validate that id is not a route segment like "products" or "new"
  if (id === "products" || id === "new" || !id || id.trim() === "") {
    redirect({ href: "/dashboard/products", locale });
  }

  const product = await getListingById(id);

  if (!product) {
    notFound();
  }

  // Admin can edit any product, seller can only edit their own
  if (roleName === "seller" && product.producerId !== userId) {
    redirect({ href: "/dashboard/products", locale });
  }

  // Fetch variants with inventory data
  const variantsWithInventory = await getListingVariantsWithInventory(id);

  const isAdmin = roleName === "admin";

  return (
    <DashboardWrapper userRole={roleName}>
      <EditProductForm
        initialData={product}
        initialVariants={variantsWithInventory}
        isAdmin={isAdmin}
      />
    </DashboardWrapper>
  );
}
