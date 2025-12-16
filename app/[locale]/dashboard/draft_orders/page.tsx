import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, store } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DraftOrdersPageClient from "./DraftOrdersPageClient";
import { listDraftOrders } from "@/app/[locale]/actions/draft-orders";

export default async function DraftOrdersPage() {
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

  // Only admin and seller can access drafts
  if (roleName === "customer") {
    redirect({ href: "/dashboard", locale });
  }

  // Fetch initial draft orders
  const initialResult = await listDraftOrders({
    selectedView: "all",
    page: 1,
    pageSize: 50,
  });

  if (!initialResult.success) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="p-6">
          <div className="text-red-600">
            {initialResult.error || "Failed to load draft orders"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <DraftOrdersPageClient
        initialData={initialResult.data || []}
        initialTotalCount={initialResult.totalCount || 0}
      />
    </DashboardWrapper>
  );
}

