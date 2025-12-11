import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { getAllCategoryRules } from "../../actions/category-rules";
import CategoryManagement from "../components/admin/CategoryManagement";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";

export default async function CategoriesPage() {
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

  // Only admin can access category rules
  if (roleName !== "admin") {
    redirect({ href: "/dashboard", locale });
  }

  const categoryRulesResult = await getAllCategoryRules();
  const initialCategoryRules = categoryRulesResult.success
    ? categoryRulesResult.result || null
    : null;

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CategoryManagement initialCategoryRules={initialCategoryRules} />
        </div>
      </div>
    </DashboardWrapper>
  );
}
