"use server";

import { ActionResponse } from "@/lib/types";
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { user, roles, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@/lib/roles";

// Validation schemas
const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 6 characters"),
});

const registerSchema = z
  .object({
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    role: z.enum(["Seller", "Customer"]).default("Customer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const emailSchema = z.object({
  email: z.email("Invalid email address"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

export async function resetPasswordAction(
  formData: FormData,
  token: string
): Promise<ActionResponse> {
  try {
    if (!token) {
      return {
        success: false,
        error: "Invalid or missing reset token",
      };
    }

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validate passwords
    const validatedData = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validatedData.success) {
      return {
        success: false,
        error: z.prettifyError(validatedData.error),
        payload: formData,
      };
    }

    // Reset password
    const result = await auth.api.resetPassword({
      body: {
        newPassword: validatedData.data.password,
        token,
      },
      headers: await headers(),
    });

    if (!result) {
      return {
        success: false,
        error: "Failed to reset password",
        payload: formData,
      };
    }

    return {
      success: true,
      message: "Password reset successfully",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof APIError
          ? error.message
          : "An error occurred during password reset",
      payload: formData,
    };
  }
}

export async function requestPasswordResetAction(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const email = formData.get("email") as string;

    // Validate email
    const validatedData = emailSchema.safeParse({ email });

    if (!validatedData.success) {
      return {
        success: false,
        error: z.prettifyError(validatedData.error),
      };
    }

    // Request password reset
    const result = await auth.api.forgetPassword({
      body: {
        email: validatedData.data.email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      },
      headers: await headers(),
    });

    if (!result) {
      return {
        success: false,
        error: "Failed to send reset email",
        payload: formData,
      };
    }

    return {
      success: true,
      message: "Password reset email sent successfully",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof APIError
          ? error.message
          : "An error occurred during password reset request",
      payload: formData,
    };
  }
}

// Login action
export async function loginAction(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    // Validate form data
    const validatedData = loginSchema.safeParse(rawData);

    if (!validatedData.success) {
      return {
        success: false,
        message: "Validation failed",
        error: z.prettifyError(validatedData.error),
        payload: formData,
      };
    }

    const result = await auth.api.signInEmail({
      body: {
        email: validatedData.data.email,
        password: validatedData.data.password,
      },
      headers: await headers(),
    });

    if (!result) {
      let error_message = "Invalid email or password";
      if (error_message === "Email not verified") {
        error_message =
          "Email not verified. Please check your email for verification.";
      }
      return {
        success: false,
        error: error_message || "Invalid email or password",
        payload: formData,
      };
    }

    // Check if this is an admin email and assign admin role if needed
    const isAdminEmail = process.env.ADMIN_LIST?.split(",").includes(
      validatedData.data.email
    );
    if (isAdminEmail) {
      // Check if user already has admin role
      const existingRole = await db
        .select()
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, result.user.id))
        .limit(1);

      if (existingRole.length === 0) {
        // Ensure Admin role exists and assign it
        const adminRole = await db
          .select()
          .from(roles)
          .where(eq(roles.name, "Admin"))
          .limit(1);

        if (adminRole.length === 0) {
          // Create Admin role if it doesn't exist
          const newAdminRole = await db
            .insert(roles)
            .values({
              name: "Admin",
              description: "Full system access and user management",
            })
            .returning();

          await db.insert(userRoles).values({
            userId: result.user.id,
            roleId: newAdminRole[0].id,
          });
        } else {
          await db.insert(userRoles).values({
            userId: result.user.id,
            roleId: adminRole[0].id,
          });
        }
      }
    }

    // Get user's role for redirect
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, result.user.id))
      .limit(1);

    const role =
      userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "customer";

    return {
      success: true,
      message: "Signed in successfully",
      redirectTo: `/dashboard/${role}`,
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error:
        error instanceof APIError
          ? error.message
          : "An error occurred during sign in. Please try again.",
      payload: formData,
    };
  }
}

// Register action
export async function registerAction(
  _prevState: ActionResponse,

  formData: FormData
): Promise<ActionResponse> {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
      name: formData.get("name") as string,
      role: formData.get("role") as string,
    };

    // Validate form data
    const validatedData = registerSchema.safeParse(rawData);

    if (!validatedData.success) {
      return {
        success: false,
        message: "Validation failed",
        error: z.prettifyError(validatedData.error),
        payload: formData,
      };
    }

    // Check if this is an admin email
    const isAdminEmail = process.env.ADMIN_LIST?.split(",").includes(
      validatedData.data.email
    );

    // Determine the role to assign
    const roleToAssign = isAdminEmail ? "Admin" : validatedData.data.role;

    // Attempt to create user using better-auth
    const response = await auth.api.signUpEmail({
      body: {
        email: validatedData.data.email,
        password: validatedData.data.password,
        name: validatedData.data.name,
        status: "pending", // Default status, will be updated based on email verification
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      },
      headers: await headers(),
    });

    if (!response) {
      return {
        success: false,
        error: "Failed to create account. Please try again.",
        payload: formData,
      };
    }

    // Set user status based on email verification
    // If email verification is required, status should be "pending"
    // If not, status should be "active"
    const userStatus = response.user.emailVerified ? "active" : "pending";

    // Update user status in database
    await db
      .update(user)
      .set({
        status: userStatus,
        updatedAt: new Date(),
      })
      .where(eq(user.id, response.user.id));

    // Assign role to user
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleToAssign))
      .limit(1);

    let roleId: number;

    if (existingRole.length === 0) {
      // Create role if it doesn't exist
      const roleDescriptions = {
        Admin: "Full system access and user management",
        Seller: "Can create and manage product listings",
        Customer: "Can browse and purchase products",
      };

      const newRole = await db
        .insert(roles)
        .values({
          name: roleToAssign,
          description:
            roleDescriptions[roleToAssign as keyof typeof roleDescriptions],
        })
        .returning();

      roleId = newRole[0].id;
    } else {
      roleId = existingRole[0].id;
    }

    // Assign role to user
    await db.insert(userRoles).values({
      userId: response.user.id,
      roleId: roleId,
    });
    return {
      success: true,
      message: "Account created successfully",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error:
        error instanceof APIError
          ? error.message
          : "An error occurred during registration. Please try again.",
      payload: formData,
    };
  }
}

// Helper function to get current user
async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

// Update user profile action
export async function updateUserProfile(data: {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentUser();

    // Update user in database
    await db
      .update(user)
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        updatedAt: new Date(),
      })
      .where(eq(user.id, currentUser.id));

    return {
      success: true,
      message: "Profile updated successfully",
    };
  } catch (error) {
    console.error("Profile update error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}

// Change password action
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResponse> {
  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (!result.ok) {
      return {
        success: false,
        error: (await result.json())?.message || "Failed to change password",
      };
    }

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    console.error("Password change error:", error);
    return {
      success: false,
      error:
        error instanceof APIError ? error.message : "Failed to change password",
    };
  }
}

// Delete account action (with verification)
export async function deleteAccount(
  token: string | undefined
): Promise<ActionResponse> {
  try {
    // List user accounts to determine provider
    const accounts = await auth.api.listUserAccounts({
      headers: await headers(),
    });

    if (!accounts || accounts.length === 0) {
      return {
        success: false,
        error: "No accounts found for user",
      };
    }

    // Check if user has credentials-based account (email/password)
    const credentialsAccount = accounts.find(
      (account: { providerId: string }) => account.providerId === "credential"
    );

    let result;

    if (credentialsAccount) {
      // User signed in with credentials - need token for deletion
      result = await auth.api.deleteUser({
        body: {
          callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/goodbye`,
          token,
        },
        headers: await headers(),
        asResponse: true,
      });
    } else {
      // User signed in with OAuth (Google, etc.) - no additional arguments needed
      result = await auth.api.deleteUser({
        body: {},
        headers: await headers(),
        asResponse: true,
      });
    }

    if (!result.ok) {
      const error_message = (await result.json())?.message;
      console.log(error_message);
      return {
        success: false,
        error:
          (error_message === "Invalid token"
            ? "Your session has expired. Please login again to delete your account."
            : error_message) || "Failed to initiate account deletion",
      };
    }

    return {
      success: true,
      message:
        "Account deletion initiated. Please check your email for verification.",
    };
  } catch (error) {
    console.error("Account deletion error:", error);
    return {
      success: false,
      error:
        error instanceof APIError
          ? error.message
          : "Failed to initiate account deletion",
    };
  }
}

// Complete onboarding for Google sign-in users
export async function completeOnboarding(
  role: UserRole
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const currentUser = session.user;

    // Check if user already has a role
    const existingUserRole = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, currentUser.id))
      .limit(1);

    if (existingUserRole.length > 0) {
      return {
        success: false,
        error: "User already has a role assigned",
      };
    }

    // Check if user exists in our database, if not create them
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (existingUser.length === 0) {
      // Create user in our database
      await db.insert(user).values({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        emailVerified: currentUser.emailVerified,
        status: "active",
        image: currentUser.image,
      });
    }

    // Check if this is an admin email
    const isAdminEmail = process.env.ADMIN_LIST?.split(",").includes(
      currentUser.email
    );
    const roleToAssign = isAdminEmail ? UserRole.ADMIN : role;

    // Get or create the role
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleToAssign))
      .limit(1);

    let roleId: number;

    if (existingRole.length === 0) {
      // Create role if it doesn't exist
      const roleDescriptions = {
        [UserRole.ADMIN]: "Full system access and user management",
        [UserRole.SELLER]: "Can create and manage product listings",
        [UserRole.CUSTOMER]: "Can browse and purchase products",
      };

      const newRole = await db
        .insert(roles)
        .values({
          name: roleToAssign,
          description: roleDescriptions[roleToAssign],
        })
        .returning();

      roleId = newRole[0].id;
    } else {
      roleId = existingRole[0].id;
    }

    // Assign role to user
    await db.insert(userRoles).values({
      userId: currentUser.id,
      roleId: roleId,
    });

    return {
      success: true,
      message: "Onboarding completed successfully",
    };
  } catch (error) {
    console.error("Onboarding error:", error);
    return {
      success: false,
      error: "Failed to complete onboarding",
    };
  }
}
