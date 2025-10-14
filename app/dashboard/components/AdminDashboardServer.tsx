import { User } from "better-auth";
import {
  getUserStats,
  getAllUsers,
  getAllRoles,
  getAllPermissions,
} from "@/app/actions/admin";
import AdminDashboardContent from "./AdminDashboardContent";

interface AdminDashboardServerProps {
  user: User;
}

export default async function AdminDashboardServer({
  user,
}: AdminDashboardServerProps) {
  // Fetch all admin data server-side
  const [statsResult, usersResult, rolesResult, permissionsResult] =
    await Promise.all([
      getUserStats(),
      getAllUsers(1, 10), // Initial page load with default pagination
      getAllRoles(),
      getAllPermissions(),
    ]);

  // Extract data from results
  const stats = statsResult.success
    ? statsResult.result !== undefined
      ? statsResult.result
      : null
    : null;
  const initialUsers = usersResult.success
    ? usersResult.result !== undefined
      ? usersResult.result
      : null
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
      initialUsers={initialUsers}
      initialRoles={initialRoles}
      initialPermissions={initialPermissions}
    />
  );
}
