import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, vendor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { getCustomer, getVendorsForFilter } from "@/app/[locale]/actions/customers";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import { CustomerForm } from "@/app/[locale]/dashboard/components/shared/CustomerForm";
import { notFound } from "next/navigation";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
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

  // Check if vendor exists (only required for sellers, not admins)
  if (roleName !== "admin") {
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session?.user.id ?? ""))
      .limit(1);

    if (vendorResult.length === 0) {
      // User doesn't have vendor setup, but we'll still show the page
      // They just won't see any customers until they set up a vendor
    }
  }

  const { id } = await params;
  const customerResult = await getCustomer(id);
  const vendorsResult = await getVendorsForFilter();
  const isAdmin = vendorsResult.success;

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

