"use client";

import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
} from "@/lib/auth-client";
import { ActionResponse } from "@/lib/types";
import { z } from "zod";

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

export const initialState: ActionResponse = {
  success: false,
  message: "",
  error: undefined,
  payload: undefined,
};

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
      token,
      newPassword: validatedData.data.password,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message || "Failed to reset password",
        payload: formData,
      };
    }

    return {
      success: true,
      message: "Password reset successfully",
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "An error occurred",
      payload: formData,
    };
  }
}

export async function requestPasswordResetAction(
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
      email: validatedData.data.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message || "Failed to send reset email",
      };
    }

    return {
      success: true,
      message: "Password reset email sent successfully",
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "An error occurred",
    };
  }
}

// Login action
export async function loginAction(formData: FormData): Promise<ActionResponse> {
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

    const result = await signIn.email({
      email: validatedData.data.email,
      password: validatedData.data.password,
    });

    if (result.data?.user?.id) {
      return {
        success: true,
        message: "Signed in successfully",
      };
    } else {
      console.log(result);
      return {
        success: false,
        error: "Invalid email or password",
        payload: formData,
      };
    }
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: "An error occurred during login. Please try again.",
      payload: formData,
    };
  }
}

// Register action
export async function registerAction(
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
    const result = await signUp.email({
      email: validatedData.data.email,
      password: validatedData.data.password,
      name: validatedData.data.name,
      phone: "",
      isAdmin: false,
    });

    if (result?.data?.user?.id) {
      return {
        success: true,
        message: "Account created successfully",
      };
    } else {
      return {
        success: false,
        error:
          result?.error?.message ||
          "Failed to create account. Please try again.",
        payload: formData,
      };
    }
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An error occurred during registration. Please try again.",
      payload: formData,
    };
  }
}
