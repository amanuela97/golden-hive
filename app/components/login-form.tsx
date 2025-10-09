import { useActionState } from "react";
import { initialState, loginAction } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionResponse } from "@/lib/types";

export default function LoginForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(async (_prevState: ActionResponse, formData: FormData) => {
    try {
      const result = await loginAction(formData);

      // Handle successful submission
      if (result.success) {
        toast.success("Signed in successfully!");
        router.push("/dashboard");
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
            defaultValue={(state.payload?.get("email") || "") as string}
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
            defaultValue={(state.payload?.get("password") || "") as string}
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
      </form>
    </div>
  );
}
