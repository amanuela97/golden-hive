import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import SettingsContent from "../../components/shared/SettingsContent";

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
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

  const { section } = await params;

  // Validate section
  const validSections = [
    "users",
    "roles",
    "permissions",
    "account",
    "contents",
    "translations",
    "categories",
    "feedbacks",
    "communications",
    "payments",
    "policies",
    "profile",
    "security",
    "shipping-billing",
    "vendor",
  ];

  if (!validSections.includes(section)) {
    redirect({ href: "/dashboard/settings/profile", locale });
  }

  // Role-based access control
  const adminOnlySections = [
    "users",
    "roles",
    "permissions",
    "contents",
    "translations",
    "categories",
    "feedbacks",
    "communications",
  ];
  if (adminOnlySections.includes(section) && roleName !== "admin") {
    redirect({ href: "/dashboard/settings/profile", locale });
  }

  const sellerOnlySections: string[] = [];
  if (sellerOnlySections.includes(section) && roleName !== "seller") {
    redirect({ href: "/dashboard/settings/profile", locale });
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <SettingsContent section={section as any} userRole={roleName} />
    </DashboardWrapper>
  );
}

