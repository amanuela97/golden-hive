import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import StoreSetupForm from "../components/store-setup-form";
import { userHasStore } from "../actions/store-members";

export default async function StoreSetupPage() {
  const locale = await getLocale();
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

