"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  user,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  listing,
} from "@/db/schema";
import { eq, and, or, like, sql, desc, asc } from "drizzle-orm";
import { ActionResponse } from "@/lib/types";
import {
  GetAllUsersResponse,
  GetUserStatsResponse,
  UserUpdateData,
  RoleUpdateData,
  PermissionUpdateData,
} from "@/lib/types";
// Helper function to get current user and verify admin status
export async function getCurrentAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user has admin role
  const adminRole = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "Admin"))
    .limit(1);

  if (adminRole.length === 0) {
    redirect("/dashboard");
  }

  const userRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, session.user.id),
        eq(userRoles.roleId, adminRole[0].id)
      )
    )
    .limit(1);

  if (userRole.length === 0) {
    redirect("/dashboard");
  }

  return session.user;
}

// Get all users with pagination and filtering
export async function getAllUsers(
  page: number = 1,
  limit: number = 10,
  search?: string,
  roleFilter?: string,
  statusFilter?: string
): Promise<ActionResponse & { result?: GetAllUsersResponse }> {
  try {
    await getCurrentAdmin();

    // Build the base query with user roles and role information
    const baseQuery = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        status: user.status,
        phone: user.phone,
        address: user.address,
        city: user.city,
        country: user.country,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleName: roles.name,
        roleId: roles.id,
      })
      .from(user)
      .leftJoin(userRoles, eq(user.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id));

    // Build where conditions
    const whereConditions = [];

    // Add search filter
    if (search) {
      whereConditions.push(
        or(like(user.name, `%${search}%`), like(user.email, `%${search}%`))
      );
    }

    // Add role filter
    if (roleFilter && roleFilter !== "all") {
      if (roleFilter === "admin") {
        whereConditions.push(eq(roles.name, "Admin"));
      } else if (roleFilter === "user") {
        whereConditions.push(
          or(
            eq(roles.name, "User"),
            eq(roles.name, "Customer"),
            eq(roles.name, "Seller"),
            sql`${roles.name} IS NULL`
          )
        );
      } else {
        whereConditions.push(eq(roles.name, roleFilter));
      }
    }

    // Add status filter
    if (statusFilter && statusFilter !== "all") {
      whereConditions.push(
        eq(user.status, statusFilter as "active" | "pending" | "suspended")
      );
    }

    // Apply where conditions
    const query =
      whereConditions.length > 0
        ? baseQuery.where(and(...whereConditions))
        : baseQuery;

    // Get total count for pagination
    const baseCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .leftJoin(userRoles, eq(user.id, userRoles.userId))
      .leftJoin(roles, eq(userRoles.roleId, roles.id));

    // Apply same filters to count query
    const countQuery =
      whereConditions.length > 0
        ? baseCountQuery.where(and(...whereConditions))
        : baseCountQuery;

    const [users, totalCountResult] = await Promise.all([
      query
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      countQuery,
    ]);

    // Get listings count for each user
    const usersWithListings = await Promise.all(
      users.map(async (userData) => {
        const listingsCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(listing)
          .where(eq(listing.producerId, userData.id));

        return {
          ...userData,
          listingsCount: listingsCount[0]?.count || 0,
          isAdmin: userData.roleName === "Admin",
        };
      })
    );

    return {
      success: true,
      result: {
        users: usersWithListings,
        totalCount: totalCountResult[0]?.count || 0,
        page,
        limit,
        totalPages: Math.ceil((totalCountResult[0]?.count || 0) / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

// Update user information
export async function updateUser(
  userId: string,
  userData: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    status?: "active" | "pending" | "suspended";
    roleId?: number;
  }
): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentAdmin();

    // Prevent admin from removing their own admin status
    if (userId === currentUser.id && userData.roleId) {
      const adminRole = await db
        .select()
        .from(roles)
        .where(eq(roles.name, "Admin"))
        .limit(1);

      if (adminRole.length > 0 && userData.roleId !== adminRole[0].id) {
        return {
          success: false,
          error: "You cannot remove your own admin privileges",
        };
      }
    }

    // Update user basic information
    const updateData: UserUpdateData = {
      updatedAt: new Date(),
    };

    if (userData.name !== undefined) updateData.name = userData.name;
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.phone !== undefined) updateData.phone = userData.phone;
    if (userData.address !== undefined) updateData.address = userData.address;
    if (userData.city !== undefined) updateData.city = userData.city;
    if (userData.country !== undefined) updateData.country = userData.country;
    if (userData.status !== undefined) updateData.status = userData.status;

    await db.update(user).set(updateData).where(eq(user.id, userId));

    // Update user role if provided
    if (userData.roleId !== undefined) {
      // If roleId is null, just remove existing roles
      if (userData.roleId === null) {
        await db.delete(userRoles).where(eq(userRoles.userId, userId));
      } else {
        // Validate that the role exists
        const roleExists = await db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.id, userData.roleId))
          .limit(1);

        if (roleExists.length === 0) {
          return {
            success: false,
            error: `Role with ID ${userData.roleId} does not exist`,
          };
        }

        // Remove existing roles
        await db.delete(userRoles).where(eq(userRoles.userId, userId));

        // Add new role
        await db.insert(userRoles).values({
          userId,
          roleId: userData.roleId,
        });
      }
    }

    return {
      success: true,
      message: "User updated successfully",
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

// Suspend user (soft delete - mark as inactive)
export async function suspendUser(userId: string): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentAdmin();

    // Prevent admin from suspending themselves
    if (userId === currentUser.id) {
      return {
        success: false,
        error: "You cannot suspend your own account",
      };
    }

    await db
      .update(user)
      .set({
        status: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return {
      success: true,
      message: "User suspended successfully",
    };
  } catch (error) {
    console.error("Error suspending user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to suspend user",
    };
  }
}

// Delete user permanently
export async function deleteUser(userId: string): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentAdmin();

    // Prevent admin from deleting themselves
    if (userId === currentUser.id) {
      return {
        success: false,
        error: "You cannot delete your own account",
      };
    }

    // Get user image before deletion
    const userData = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const userImage = userData[0]?.image;

    // Delete user from database
    await db.delete(user).where(eq(user.id, userId));

    // Delete profile image from Cloudinary if it exists
    if (userImage) {
      try {
        const { deleteFileByPublicId, extractPublicId } = await import(
          "@/lib/cloudinary"
        );
        const publicId = extractPublicId(userImage);
        if (publicId) {
          await deleteFileByPublicId(publicId);
          console.log(`Deleted profile image for user: ${userId}`);
        }
      } catch (error) {
        console.error("Error deleting profile image:", error);
        // Don't fail the operation if image deletion fails
      }
    }

    return {
      success: true,
      message: "User deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}

// Send password reset email to user
export async function sendPasswordResetToUser(
  userId: string
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Get user email
    const userRecord = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userRecord.length === 0) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Use better-auth's password reset functionality
    const result = await auth.api.forgetPassword({
      body: {
        email: userRecord[0].email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      },
      headers: await headers(),
    });

    if (!result.status) {
      return {
        success: false,
        error: "Failed to send password reset email",
      };
    }

    return {
      success: true,
      message: "Password reset email sent successfully",
    };
  } catch (error) {
    console.error("Error sending password reset:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send password reset email",
    };
  }
}

// Get user statistics
export async function getUserStats(): Promise<
  ActionResponse & { result?: GetUserStatsResponse }
> {
  try {
    await getCurrentAdmin();

    // Get total users
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);

    // Get admin users count
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "Admin"))
      .limit(1);

    let adminUsersCount = 0;
    if (adminRole.length > 0) {
      const adminUsersResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(userRoles)
        .where(eq(userRoles.roleId, adminRole[0].id));
      adminUsersCount = adminUsersResult[0]?.count || 0;
    }

    console.log("adminUsersCount", adminUsersCount);
    // Get verified users count
    const verifiedUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(eq(user.emailVerified, true));

    // Get active users count
    const activeUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(eq(user.status, "active"));

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignupsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(sql`${user.createdAt} > ${thirtyDaysAgo}`);

    return {
      success: true,
      data: {
        totalUsers: totalUsersResult[0]?.count || 0,
        adminUsers: adminUsersCount,
        verifiedUsers: verifiedUsersResult[0]?.count || 0,
        activeUsers: activeUsersResult[0]?.count || 0,
        recentSignups: recentSignupsResult[0]?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch user statistics",
    };
  }
}

// ===== ROLE MANAGEMENT FUNCTIONS =====

// Get all roles with their permissions
export async function getAllRoles(): Promise<
  ActionResponse & {
    result?: Array<{
      id: number;
      name: string;
      description: string | null;
      userCount: number;
      permissions: Array<{
        id: string;
        name: string;
        description: string | null;
        category: string | null;
        createdAt: Date | null;
        updatedAt: Date;
      }>;
      createdAt: Date | null;
      updatedAt: Date;
    }>;
  }
> {
  try {
    await getCurrentAdmin();

    const rolesList = await db.select().from(roles).orderBy(asc(roles.name));

    // Get user count and permissions for each role
    const rolesWithCountsAndPermissions = await Promise.all(
      rolesList.map(async (role) => {
        // Get user count
        const userCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(userRoles)
          .where(eq(userRoles.roleId, role.id));

        // Get role permissions
        const rolePermissionsList = await db
          .select({
            id: permissions.id,
            name: permissions.name,
            description: permissions.description,
            category: permissions.category,
            createdAt: permissions.createdAt,
            updatedAt: permissions.updatedAt,
          })
          .from(rolePermissions)
          .innerJoin(
            permissions,
            eq(rolePermissions.permissionId, permissions.id)
          )
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          userCount: userCount[0]?.count || 0,
          permissions: rolePermissionsList,
        };
      })
    );

    return {
      success: true,
      result: rolesWithCountsAndPermissions,
    };
  } catch (error) {
    console.error("Error fetching roles:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch roles",
    };
  }
}

// Create a new role
export async function createRole(roleData: {
  name: string;
  description?: string;
  permissions: string[];
}): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if role name already exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleData.name))
      .limit(1);

    if (existingRole.length > 0) {
      return {
        success: false,
        error: "Role with this name already exists",
      };
    }

    // Create the role
    const newRole = await db
      .insert(roles)
      .values({
        name: roleData.name,
        description: roleData.description,
      })
      .returning();

    // Add permissions to the role
    if (roleData.permissions.length > 0) {
      const rolePermissionValues = roleData.permissions.map((permissionId) => ({
        roleId: newRole[0].id,
        permissionId,
      }));

      await db.insert(rolePermissions).values(rolePermissionValues);
    }

    return {
      success: true,
      message: "Role created successfully",
      result: newRole[0],
    };
  } catch (error) {
    console.error("Error creating role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create role",
    };
  }
}

// Update a role
export async function updateRole(
  roleId: number,
  roleData: {
    name?: string;
    description?: string;
    permissions?: string[];
  }
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if role exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (existingRole.length === 0) {
      return {
        success: false,
        error: "Role not found",
      };
    }

    // Check if new name conflicts with existing roles (if name is being updated)
    if (roleData.name && roleData.name !== existingRole[0].name) {
      const nameConflict = await db
        .select()
        .from(roles)
        .where(
          and(eq(roles.name, roleData.name), sql`${roles.id} != ${roleId}`)
        )
        .limit(1);

      if (nameConflict.length > 0) {
        return {
          success: false,
          error: "Role with this name already exists",
        };
      }
    }

    // Update the role
    const updateData: RoleUpdateData = {
      updatedAt: new Date(),
    };

    if (roleData.name !== undefined) updateData.name = roleData.name;
    if (roleData.description !== undefined)
      updateData.description = roleData.description;

    await db.update(roles).set(updateData).where(eq(roles.id, roleId));

    // Update permissions if provided
    if (roleData.permissions !== undefined) {
      // Remove existing permissions
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      // Add new permissions
      if (roleData.permissions.length > 0) {
        const rolePermissionValues = roleData.permissions.map(
          (permissionId) => ({
            roleId,
            permissionId,
          })
        );

        await db.insert(rolePermissions).values(rolePermissionValues);
      }
    }

    return {
      success: true,
      message: "Role updated successfully",
    };
  } catch (error) {
    console.error("Error updating role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

// Delete a role
export async function deleteRole(roleId: number): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if role exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (existingRole.length === 0) {
      return {
        success: false,
        error: "Role not found",
      };
    }

    // Prevent deletion of Admin role
    if (existingRole[0].name === "Admin") {
      return {
        success: false,
        error: "Cannot delete the Admin role",
      };
    }

    // Check if role has users assigned
    const usersWithRole = await db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    if (usersWithRole[0]?.count && usersWithRole[0].count > 0) {
      return {
        success: false,
        error:
          "Cannot delete role that has users assigned. Please reassign users first.",
      };
    }

    // Delete the role (permissions will be deleted automatically due to cascade)
    await db.delete(roles).where(eq(roles.id, roleId));

    return {
      success: true,
      message: "Role deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting role:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete role",
    };
  }
}

// ===== PERMISSION MANAGEMENT FUNCTIONS =====

// Get all permissions
export async function getAllPermissions(): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      createdAt: Date | null;
      updatedAt: Date;
    }>;
  }
> {
  try {
    await getCurrentAdmin();

    const permissionsList = await db
      .select()
      .from(permissions)
      .orderBy(asc(permissions.category), asc(permissions.name));

    return {
      success: true,
      result: permissionsList,
    };
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch permissions",
    };
  }
}

// Create a new permission
export async function createPermission(permissionData: {
  name: string;
  description?: string;
  category?: string;
}): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Generate a unique random ID
    const randomString = await import("random-string-generator");
    const permissionId = randomString.default(12);

    // Create the permission
    const newPermission = await db
      .insert(permissions)
      .values({
        id: permissionId,
        name: permissionData.name,
        description: permissionData.description,
        category: permissionData.category,
      })
      .returning();

    return {
      success: true,
      message: "Permission created successfully",
      result: newPermission[0],
    };
  } catch (error) {
    console.error("Error creating permission:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create permission",
    };
  }
}

// Update a permission
export async function updatePermission(
  permissionId: string,
  permissionData: {
    name?: string;
    description?: string;
    category?: string;
  }
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if permission exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, permissionId))
      .limit(1);

    if (existingPermission.length === 0) {
      return {
        success: false,
        error: "Permission not found",
      };
    }

    // Update the permission
    const updateData: PermissionUpdateData = {
      updatedAt: new Date(),
    };

    if (permissionData.name !== undefined)
      updateData.name = permissionData.name;
    if (permissionData.description !== undefined)
      updateData.description = permissionData.description;
    if (permissionData.category !== undefined)
      updateData.category = permissionData.category;

    await db
      .update(permissions)
      .set(updateData)
      .where(eq(permissions.id, permissionId));

    return {
      success: true,
      message: "Permission updated successfully",
    };
  } catch (error) {
    console.error("Error updating permission:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update permission",
    };
  }
}

// Delete a permission
export async function deletePermission(
  permissionId: string
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if permission exists
    const existingPermission = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, permissionId))
      .limit(1);

    if (existingPermission.length === 0) {
      return {
        success: false,
        error: "Permission not found",
      };
    }

    // Delete the permission (role permissions will be deleted automatically due to cascade)
    await db.delete(permissions).where(eq(permissions.id, permissionId));

    return {
      success: true,
      message: "Permission deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting permission:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete permission",
    };
  }
}

// Get role with its permissions
export async function getRoleWithPermissions(roleId: number): Promise<
  ActionResponse & {
    result?: {
      id: number;
      name: string;
      description: string | null;
      userCount: number;
      permissions: Array<{
        id: string;
        name: string;
        description: string | null;
        category: string | null;
        createdAt: Date | null;
        updatedAt: Date;
      }>;
      createdAt: Date | null;
      updatedAt: Date;
    };
  }
> {
  try {
    await getCurrentAdmin();

    // Get role details with user count
    const role = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (role.length === 0) {
      return {
        success: false,
        error: "Role not found",
      };
    }

    // Get user count for this role
    const userCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));

    const userCount = userCountResult[0]?.count || 0;

    // Get role permissions
    const rolePermissionsList = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        description: permissions.description,
        category: permissions.category,
        createdAt: permissions.createdAt,
        updatedAt: permissions.updatedAt,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return {
      success: true,
      result: {
        ...role[0],
        userCount,
        permissions: rolePermissionsList,
      },
    };
  } catch (error) {
    console.error("Error fetching role with permissions:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch role with permissions",
    };
  }
}
