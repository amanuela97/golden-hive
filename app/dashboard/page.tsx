import { User } from "better-auth";
import DashboardContent from "@/app/components/dashboardContent";
import AdminDashboardServer from "@/app/dashboard/components/AdminDashboardServer";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getListingsByProducer } from "@/lib/listing";
import { listUserAccounts } from "@/lib/auth";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function Dashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const accounts = await listUserAccounts({
    headers: await headers(),
  });
  const isCredential = accounts?.[0]?.providerId === "credential";

  if (!session) {
    redirect("/login");
  }

  // Check if user has admin role
  const userRole = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);

  const isAdmin = userRole.length > 0 && userRole[0].roles.name === "Admin";

  // Check if user is admin and redirect to admin dashboard
  if (isAdmin) {
    return <AdminDashboardServer user={session.user} />;
  }

  // Fetch products server-side for regular users
  const products = await getListingsByProducer(session.user.id);

  return (
    <DashboardContent
      user={session?.user as User}
      products={products}
      isCredential={isCredential}
    />
  );
}
