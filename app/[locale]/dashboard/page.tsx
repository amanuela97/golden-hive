import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import DashboardHomeServer from "./components/shared/DashboardHomeServer";
import { autoAssignMarketToUser } from "@/app/[locale]/actions/markets";

export default async function DashboardPage() {
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

  // Auto-assign market for new seller/admin users (first successful dashboard login)
  if ((roleName === "admin" || roleName === "seller") && session?.user?.id) {
    try {
      // Check if user has a market assigned
      const userData = await db
        .select({ marketId: user.marketId })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      if (userData.length > 0 && !userData[0].marketId) {
        // User doesn't have a market, auto-assign one (non-blocking)
        // Don't await to avoid blocking page load if there's an error
        autoAssignMarketToUser(session.user.id).catch((error) => {
          console.error("Failed to auto-assign market:", error);
          // Silently fail - user can set market manually later
        });
      }
    } catch (error) {
      // Silently fail - don't block dashboard access
      console.error("Error checking/assigning market:", error);
    }
  }

  return <DashboardHomeServer userRole={roleName} />;
}
