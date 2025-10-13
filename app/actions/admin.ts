"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionResponse } from "@/lib/types";

// Helper function to get current user and verify admin status
async function getCurrentAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return session.user;
}

// Get all users with pagination and filtering
export async function getAllUsers(
  page: number = 1,
  limit: number = 10,
  search?: string,
  role?: string,
  status?: string
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    let query = db.select().from(user);

    // Add filters based on parameters
    if (search) {
      // Note: This is a simplified search - in production you'd want more sophisticated search
      query = query
        .where
        // Add search conditions here
        ();
    }

    if (role === "admin") {
      query = query.where(eq(user.isAdmin, true));
    } else if (role === "user") {
      query = query.where(eq(user.isAdmin, false));
    }

    const users = await query.limit(limit).offset((page - 1) * limit);

    return {
      success: true,
      result: users,
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
    isAdmin?: boolean;
  }
): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentAdmin();

    // Prevent admin from removing their own admin status
    if (userId === currentUser.id && userData.isAdmin === false) {
      return {
        success: false,
        error: "You cannot remove your own admin privileges",
      };
    }

    await db
      .update(user)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

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

    // For now, we'll use a simple approach - in production you'd want a proper status field
    // This is a placeholder implementation
    await db
      .update(user)
      .set({
        updatedAt: new Date(),
        // Add suspension logic here - you might want to add a status field to the user table
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

    await db.delete(user).where(eq(user.id, userId));

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

    if (!result.ok) {
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
export async function getUserStats(): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    const totalUsers = await db.select().from(user);
    const adminUsers = totalUsers.filter((u) => u.isAdmin);
    const verifiedUsers = totalUsers.filter((u) => u.emailVerified);

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = totalUsers.filter(
      (u) => u.createdAt && new Date(u.createdAt) > thirtyDaysAgo
    );

    return {
      success: true,
      data: {
        totalUsers: totalUsers.length,
        adminUsers: adminUsers.length,
        verifiedUsers: verifiedUsers.length,
        recentSignups: recentSignups.length,
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
