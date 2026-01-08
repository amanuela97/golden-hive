import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { redirect } from "@/i18n/navigation";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import SettingsContent from "../../components/shared/SettingsContent";
import DashboardNotFound from "../../not-found";

type SettingsSection =
  | "store"
  | "users"
  | "roles"
  | "permissions"
  | "account"
  | "contents"
  | "translations"
  | "categories"
  | "feedbacks"
  | "communications"
  | "payments"
  | "policies"
  | "profile"
  | "security"
  | "shipping-billing"
  | "shipping-settings";

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  // Use protectDashboardRoute to automatically check route access based on navigation config
  // Explicitly pass the pathname to ensure it's detected correctly
  const result = await protectDashboardRoute({
    pathname: `/dashboard/settings/${section}`,
    showNotFound: true,
  });

  // Debug logging

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName, locale } = result;

  // Validate section exists
  const validSections = [
    "users",
    "roles",
    "permissions",
    "account",
    "contents",
    "translations",
    "categories",
    "feedbacks",
    "communications",
    "payments",
    "policies",
    "profile",
    "security",
    "shipping-billing",
    "shipping-settings",
    "store",
  ];

  if (!validSections.includes(section)) {
    // Invalid section - redirect to appropriate default based on role
    const defaultSection = roleName === "customer" ? "profile" : "store";
    redirect({ href: `/dashboard/settings/${defaultSection}`, locale });
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <SettingsContent
        section={section as SettingsSection}
        userRole={roleName}
      />
    </DashboardWrapper>
  );
}
