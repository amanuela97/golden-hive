import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import TranslationsPageClient from "./TranslationsPageClient";
import { notFound } from "next/navigation";

export default async function TranslationsPage() {
  const { role, shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin"],
  });

  if (shouldShowNotFound) {
    notFound();
  }

  return (
    <DashboardWrapper userRole={role}>
      <TranslationsPageClient />
    </DashboardWrapper>
  );
}
