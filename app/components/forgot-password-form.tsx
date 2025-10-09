"use client";

import { useActionState } from "react";
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
import { requestPasswordResetAction, initialState } from "@/app/actions/auth";
import { ActionResponse } from "@/lib/types";

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(async (_prevState: ActionResponse, formData: FormData) => {
    try {
      const result = await requestPasswordResetAction(formData);
      if (result.success) {
        toast.success("Password reset email sent! Check your inbox.");
      }
      return result;
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message || "An error occurred",
        error: undefined,
      };
    }
  }, initialState);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Forgot Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              type="email"
              id="email"
              name="email"
              required
              className={state.error ? "border-red-500" : ""}
              placeholder="Enter your email"
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
            {isPending ? "Sending..." : "Send Reset Email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
