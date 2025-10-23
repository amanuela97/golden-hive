import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function Dashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get user's role
  const userRole = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);

  if (userRole.length === 0) {
    // User has no role, redirect to onboarding
    redirect("/onboarding");
  }

  const roleName = userRole[0].roleName.toLowerCase();
  
  // Redirect to appropriate role-based dashboard
  redirect(`/dashboard/${roleName}`);
}
