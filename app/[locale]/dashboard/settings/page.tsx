import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function SettingsPage() {
  const locale = await getLocale();
  // Redirect to profile by default
  redirect({ href: "/dashboard/settings/profile", locale });
}

