"use client";

import SettingsContent from "./SettingsContent";

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

interface SettingsPageWithBackProps {
  section: SettingsSection;
  userRole: "admin" | "seller" | "customer";
}

export function SettingsPageWithBack({ section, userRole }: SettingsPageWithBackProps) {
  return <SettingsContent section={section} userRole={userRole} />;
}
