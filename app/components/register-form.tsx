"use client";
import { useActionState, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionResponse, initialState } from "@/lib/types";
import { useRouter } from "next/navigation";
import { registerAction } from "../actions/auth";
import { UserRole } from "@/lib/roles";
export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);

  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(registerAction, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(
        "Account created successfully! Please check your email for verification.",
        {
          duration: 8000,
        }
      );
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      router.push("/login");
    } else if (state.error) {
      if (state?.payload) {
        setName((state.payload.get("name") as string) || "");
        setEmail((state.payload.get("email") as string) || "");
        setPassword((state.payload.get("password") as string) || "");
        setConfirmPassword(
          (state.payload.get("confirmPassword") as string) || ""
        );
        setRole((state.payload.get("role") as UserRole) || UserRole.CUSTOMER);
      }
    }
  }, [state, router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <form action={formAction} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              state.error ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </div>

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
            htmlFor="role"
            className="block text-sm font-medium text-gray-700"
          >
            Role
          </label>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as UserRole)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UserRole.CUSTOMER}>Customer</SelectItem>
              <SelectItem value={UserRole.SELLER}>Seller</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="role" value={role} />
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

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700"
          >
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
              state.error ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        {state.error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
    </div>
  );
}
