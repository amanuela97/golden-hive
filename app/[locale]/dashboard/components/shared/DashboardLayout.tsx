"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DashboardNavbar } from "./DashboardNavbar";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: "admin" | "seller" | "customer";
}

export function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Check if we're on a settings page
  const isSettingsPage = pathname?.startsWith("/dashboard/settings");

  useEffect(() => {
    setIsSettingsOpen(isSettingsPage);
  }, [isSettingsPage]);

  return (
    <div className="min-h-screen">
      <DashboardNavbar />
      <Sidebar
        userRole={userRole}
        onSettingsClick={() => {
          router.push("/dashboard/settings/profile");
        }}
      />
      <main className="pl-56 pt-14">
        <div className="p-6">{children}</div>
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          // Only redirect to dashboard if we're currently on a settings page
          if (pathname?.startsWith("/dashboard/settings")) {
            // Update URL immediately using window.history to prevent brief flash of settings page
            // This ensures the URL changes synchronously before React re-renders
            const currentLocale = window.location.pathname.split('/')[1] || 'en';
            const newPath = `/${currentLocale}/dashboard`;
            window.history.replaceState(null, '', newPath);
            // Use replace to let Next.js router handle the actual navigation
            // The useEffect watching isSettingsPage will close the modal when pathname changes
            router.replace("/dashboard");
          } else {
            // If not on settings page, just close the modal
            setIsSettingsOpen(false);
          }
        }}
        userRole={userRole}
      />
    </div>
  );
}
