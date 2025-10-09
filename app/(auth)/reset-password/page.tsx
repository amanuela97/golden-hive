import ResetPasswordForm from "@/app/components/reset-password-form";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Need to request a new reset link?{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Request new link
            </Link>
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
