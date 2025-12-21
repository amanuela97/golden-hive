import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import DashboardHomeServer from "./components/shared/DashboardHomeServer";
import { autoAssignMarketToUser } from "@/app/[locale]/actions/markets";
import { getUserRole } from "@/lib/user-role";

// Optimize page rendering - allow dynamic rendering but cache when possible
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  // Parallelize independent operations
  const [locale, headersList] = await Promise.all([getLocale(), headers()]);

  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Use cached function to get user role (deduplicates within same render)
  const { roleName: rawRoleName, error: roleError } = await getUserRole(
    session?.user?.id ?? ""
  );

  if (roleError || !rawRoleName) {
    redirect({ href: "/onboarding", locale });
  }

  const roleName = rawRoleName as "admin" | "seller" | "customer";

  // Auto-assign market for new seller/admin users (first successful dashboard login)
  // Run in parallel with page render to avoid blocking
  if ((roleName === "admin" || roleName === "seller") && session?.user?.id) {
    // Check if user has a market assigned (non-blocking)
    db.select({ marketId: user.marketId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
      .then((userData) => {
        if (userData.length > 0 && !userData[0].marketId) {
          // User doesn't have a market, auto-assign one (non-blocking)
          autoAssignMarketToUser(session.user.id).catch((error) => {
            console.error("Failed to auto-assign market:", error);
            // Silently fail - user can set market manually later
          });
        }
      })
      .catch((error) => {
        // Silently fail - don't block dashboard access
        console.error("Error checking market assignment:", error);
      });
  }

  return <DashboardHomeServer userRole={roleName} />;
}
