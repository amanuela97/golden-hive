"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllUsers,
  updateUser,
  deleteUser,
  suspendUser,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getRoleWithPermissions,
} from "@/app/actions/admin";
import toast from "react-hot-toast";
import {
  PermissionUpdateData,
  RoleUpdateData,
  UserUpdateData,
} from "@/lib/types";

// Query Keys
export const queryKeys = {
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
  usersWithFilters: (
    page: number,
    limit: number,
    search?: string,
    roleFilter?: string,
    statusFilter?: string
  ) =>
    ["users", "list", page, limit, search, roleFilter, statusFilter] as const,
  roles: ["roles"] as const,
  role: (id: number) => ["roles", id] as const,
  permissions: ["permissions"] as const,
  permission: (id: string) => ["permissions", id] as const,
};

// User Queries
export function useUsers(
  page: number = 1,
  limit: number = 10,
  search?: string,
  roleFilter?: string,
  statusFilter?: string
) {
  return useQuery({
    queryKey: queryKeys.usersWithFilters(
      page,
      limit,
      search,
      roleFilter,
      statusFilter
    ),
    queryFn: () => getAllUsers(page, limit, search, roleFilter, statusFilter),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      userData,
    }: {
      userId: string;
      userData: UserUpdateData;
    }) => updateUser(userId, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success("User updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user");
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success("User deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast.success("User suspended successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to suspend user");
    },
  });
}

// Role Queries
export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: getAllRoles,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      toast.success("Role created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create role");
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      roleData,
    }: {
      roleId: number;
      roleData: RoleUpdateData;
    }) => updateRole(roleId, roleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      toast.success("Role updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      toast.success("Role deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete role");
    },
  });
}

export function useRoleWithPermissions(roleId: number) {
  return useQuery({
    queryKey: queryKeys.role(roleId),
    queryFn: () => getRoleWithPermissions(roleId),
    enabled: !!roleId,
  });
}

// Permission Queries
export function usePermissions() {
  return useQuery({
    queryKey: queryKeys.permissions,
    queryFn: getAllPermissions,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions });
      toast.success("Permission created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create permission");
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      permissionId,
      permissionData,
    }: {
      permissionId: string;
      permissionData: PermissionUpdateData;
    }) => updatePermission(permissionId, permissionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions });
      toast.success("Permission updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update permission");
    },
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions });
      toast.success("Permission deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete permission");
    },
  });
}
