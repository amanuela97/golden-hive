import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale, setRequestLocale } from "next-intl/server";
import StoreSetupForm from "../components/store-setup-form";
import { userHasStore } from "../actions/store-members";

export const dynamic = "force-dynamic";

export default async function StoreSetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Check if user already has a store
  const { hasStore } = await userHasStore();
  if (hasStore) {
    redirect({ href: "/dashboard", locale });
  }

  return <StoreSetupForm />;
}
