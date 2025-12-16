import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import MarketsPageClient from "./MarketsPageClient";
import { listMarkets } from "@/app/[locale]/actions/markets-management";

export default async function MarketsPage() {
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

  // Only admin and seller can access markets
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  // Fetch initial markets data (only user's own markets)
  const result = await listMarkets();

  return (
    <DashboardWrapper userRole={roleName}>
      <MarketsPageClient initialData={result.data || []} userRole={roleName} />
    </DashboardWrapper>
  );
}

