"use client";
import { useActionState, useEffect, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionResponse, initialState } from "@/lib/types";
import { GoogleSignInButton } from "./google-sign-in-button";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(loginAction, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? "Signed in successfully!");
      setEmail("");
      setPassword("");
      // Use redirectTo from response, fallback to /dashboard
      const redirectPath = (state as ActionResponse & { redirectTo?: string }).redirectTo || "/dashboard";
      router.push(redirectPath);
    } else if (state.error) {
      // Restore payload values from failed attempt
      if (state?.payload) {
        setEmail((state.payload.get("email") as string) || "");
        setPassword((state.payload.get("password") as string) || "");
      }
    }
  }, [router, state]);

  return (
    <div className="w-full max-w-md mx-auto">
      <form action={formAction} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              state.error ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              state.error ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Forgot your password?
          </Link>
        </div>

        {state.error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
        <div className="w-full max-w-md space-y-8">
          <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
            <GoogleSignInButton />
          </div>
        </div>
      </form>
    </div>
  );
}
