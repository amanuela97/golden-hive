"use server";

import {
  requestPasswordReset,
  resetPassword,
  signInEmail,
  signUpEmail,
} from "@/lib/auth";
import { ActionResponse } from "@/lib/types";
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    const result = await resetPassword({
      body: {
        newPassword: validatedData.data.password,
        token,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (!result.ok) {
      return {
        success: false,
        error: (await result.json())?.message || "Failed to reset password",
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
    const result = await requestPasswordReset({
      body: {
        email: validatedData.data.email,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (!result.ok) {
      return {
        success: false,
        error: (await result.json())?.message || "Failed to send reset email",
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

    const result = await signInEmail({
      body: {
        email: validatedData.data.email,
        password: validatedData.data.password,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (!result.ok) {
      let error_message = (await result.json())?.message;
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

    return {
      success: true,
      message: "Signed in successfully",
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

    // Attempt to create user using Stack auth
    const response = await signUpEmail({
      body: {
        email: validatedData.data.email,
        password: validatedData.data.password,
        name: validatedData.data.name,
        isAdmin:
          process.env.ADMIN_LIST?.split(",").includes(
            validatedData.data.email
          ) || false,
        callbackURL: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      },
      headers: await headers(),
      asResponse: true,
    });

    if (!response.ok) {
      return {
        success: false,
        error:
          (await response.json())?.message ||
          "Failed to create account. Please try again.",
        payload: formData,
      };
    }
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
