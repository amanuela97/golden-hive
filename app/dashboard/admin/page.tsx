import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardContent from "../components/AdminDashboardContent";

export default async function AdminDashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user is admin
  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return <AdminDashboardContent user={session.user} />;
}
