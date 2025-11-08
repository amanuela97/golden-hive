import {
  getUserStats,
  getAllRoles,
  getAllPermissions,
} from "../../actions/admin";
import AdminDashboardContent from "./AdminDashboardContent";
import { GetUserStatsResponse } from "@/lib/types";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminDashboardServer() {
  // Get current user from session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = session.user;
  // Fetch all admin data server-side
  const [statsResult, rolesResult, permissionsResult] = await Promise.all([
    getUserStats(),
    getAllRoles(),
    getAllPermissions(),
  ]);

  // Extract data from results
  const stats = statsResult.success
    ? (statsResult.data as GetUserStatsResponse)
    : null;
  const initialRoles = rolesResult.success
    ? rolesResult.result !== undefined
      ? rolesResult.result
      : null
    : null;
  const initialPermissions = permissionsResult.success
    ? permissionsResult.result !== undefined
      ? permissionsResult.result
      : null
    : null;

  return (
    <AdminDashboardContent
      user={user}
      initialStats={stats}
      initialRoles={initialRoles}
      initialPermissions={initialPermissions}
    />
  );
}
