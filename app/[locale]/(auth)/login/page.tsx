import LoginForm from "../../components/login-form";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function Login() {
  const t = await getTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t("signInTitle")}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("or")}{" "}
            <Link
              href="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t("createNewAccount")}
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
