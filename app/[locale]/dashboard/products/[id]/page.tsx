import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { getListingById } from "@/lib/listing";
import { notFound } from "next/navigation";
import EditProductForm from "./EditProductForm";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  if (roleName === "seller" && product.producerId !== session?.user?.id) {
    redirect({ href: "/dashboard/products", locale });
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <EditProductForm initialData={product} />
    </DashboardWrapper>
  );
}
