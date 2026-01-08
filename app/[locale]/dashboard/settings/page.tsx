import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getDashboardUser } from "@/app/[locale]/lib/dashboard-auth";

export default async function SettingsPage() {
  const locale = await getLocale();
  const { role } = await getDashboardUser();

  // Redirect to appropriate settings section based on role
  if (role === "customer") {
    redirect({ href: "/dashboard/settings/profile", locale });
  } else {
    redirect({ href: "/dashboard/settings/store", locale });
  }
}
