import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import AdminDocumentationContent from "../components/shared/AdminDocumentationContent";
import SellerDocumentationContent from "../components/shared/SellerDocumentationContent";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";

export default async function DocumentationPage() {
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

  // Only admin and seller can access documentation
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  // Render different content based on role
  return (
    <DashboardWrapper userRole={roleName}>
      {roleName === "admin" ? (
        <AdminDocumentationContent />
      ) : (
        <SellerDocumentationContent sellerId={session?.user?.id ?? ""} />
      )}
    </DashboardWrapper>
  );
}

