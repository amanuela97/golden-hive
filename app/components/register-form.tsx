import { useActionState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { ActionResponse } from "@/lib/types";
import { useRouter } from "next/navigation";
import { registerAction, initialState } from "../actions/auth";
export default function RegisterForm() {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<
    ActionResponse,
    FormData
  >(
    async (
      _prevState: ActionResponse,
      formData: FormData
    ): Promise<ActionResponse> => {
      try {
        const result = await registerAction(formData);
        if (result.success) {
          toast.success("Account created successfully");
          router.push("/dashboard");
        }
        return result;
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || "An error occurred",
          payload: formData,
        };
      }
    },
    initialState
  );

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
            defaultValue={(state.payload?.get("name") || "") as string}
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
            defaultValue={
              (state.payload?.get("confirmPassword") || "") as string
            }
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
