import { User } from "better-auth";
import DashboardContent from "@/app/components/dashboardContent";
import AdminDashboardContent from "@/app/dashboard/components/AdminDashboardContent";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getListingsByProducer } from "@/lib/listing";
import { listUserAccounts } from "@/lib/auth";

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

  // Check if user is admin and redirect to admin dashboard
  if (session.user.isAdmin) {
    return <AdminDashboardContent user={session.user} />;
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
