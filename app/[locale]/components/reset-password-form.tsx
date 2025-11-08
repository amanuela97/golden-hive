"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resetPasswordAction } from "../actions/auth";
import { ActionResponse, initialState } from "@/lib/types";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(async (_prevState, formData) => {
    return await resetPasswordAction(formData, token as string);
  }, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? "Password reset successfully!");
      setPassword("");
      setConfirmPassword("");
      router.push("/login");
    } else if (state.error) {
      if (state?.payload) {
        setPassword((state.payload.get("password") as string) || "");
        setConfirmPassword(
          (state.payload.get("confirmPassword") as string) || ""
        );
      }
    }
  }, [state, router]);

  if (!token) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Invalid Reset Link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push("/forgot-password")}
            className="w-full"
          >
            Request New Reset Link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              type="password"
              id="password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              className={state.error ? "border-red-500" : ""}
              placeholder="Enter your new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              className={state.error ? "border-red-500" : ""}
              placeholder="Confirm your new password"
            />
          </div>

          {state.error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {state.error}
            </div>
          )}

          {state.success && (
            <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md">
              {state.message}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
