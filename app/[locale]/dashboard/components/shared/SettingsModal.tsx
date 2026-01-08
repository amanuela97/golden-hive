"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SettingsContent from "./SettingsContent";
import {
  settingsSections,
  type UserRole,
} from "@/app/[locale]/dashboard/config/navigation";

type SettingsSection =
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
  | "profile"
  | "security"
  | "shipping-billing"
  | "shipping-settings"
  | "store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
}

export function SettingsModal({
  isOpen,
  onClose,
  userRole,
}: SettingsModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<SettingsSection>("store");

  const validSections: SettingsSection[] = [
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
    "profile",
    "security",
    "shipping-billing",
    "shipping-settings",
    "store",
  ];

  // Extract section from URL
  useEffect(() => {
    // Handle both with and without locale prefix
    // usePathname from next-intl returns path without locale (e.g., "/dashboard/settings/store")
    const settingsMatch = pathname.match(/\/dashboard\/settings\/([^\/]+)/);
    if (settingsMatch) {
      const section = settingsMatch[1];
      // Check if section is valid
      if (section && validSections.includes(section as SettingsSection)) {
        setActiveSection(section as SettingsSection);
        return;
      } else {
        // If section is in URL but not valid, log for debugging
        console.warn(
          "Invalid settings section in URL:",
          section,
          "Valid sections:",
          validSections
        );
        // Don't change activeSection if invalid - this prevents unwanted redirects
        return;
      }
    }

    // Only default to store if pathname is exactly /dashboard/settings (no section specified)
    // Don't change if we're already on a settings page with a section
    if (pathname === "/dashboard/settings") {
      setActiveSection("store");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!isOpen) return null;

  // Filter sections based on user role
  const visibleSections = settingsSections.filter(
    (section) => !section.roles || section.roles.includes(userRole)
  );

  const activeSectionConfig = visibleSections.find(
    (s) => s.id === activeSection
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-xl border-t border-border bg-background shadow-lg">
        <div className="flex h-full">
          {/* Left Sidebar */}
          <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
            <div className="p-4 flex-shrink-0">
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <nav className="px-2 flex-1 overflow-y-auto">
              <ul className="space-y-1 pb-2">
                {visibleSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;

                  const handleClick = () => {
                    if (section.href) {
                      // Navigate to external page without closing modal first
                      // The navigation will happen and the modal will close naturally
                      router.push(section.href);
                      // Don't call onClose() here as it redirects to /dashboard
                      // The modal will be closed by DashboardLayout when pathname changes
                    } else {
                      router.push(`/dashboard/settings/${section.id}`);
                    }
                  };

                  return (
                    <li key={section.id}>
                      <button
                        onClick={handleClick}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors flex items-center gap-2",
                          isActive
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
              <h3 className="text-xl font-semibold capitalize">
                {activeSectionConfig?.label || activeSection}
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6">
              {activeSectionConfig?.href ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">
                    Redirecting to {activeSectionConfig.label}...
                  </p>
                </div>
              ) : (
                <SettingsContent section={activeSection} userRole={userRole} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
