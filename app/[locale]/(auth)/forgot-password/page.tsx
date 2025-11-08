import ForgotPasswordForm from "../../components/forgot-password-form";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t("forgotPassword")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("rememberPassword")}{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t("signIn")}
            </Link>
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
