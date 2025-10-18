import { User } from "better-auth";
import {
  getUserStats,
  getAllRoles,
  getAllPermissions,
} from "@/app/actions/admin";
import AdminDashboardContent from "./AdminDashboardContent";
import { GetUserStatsResponse } from "@/lib/types";

interface AdminDashboardServerProps {
  user: User;
}

export default async function AdminDashboardServer({
  user,
}: AdminDashboardServerProps) {
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
