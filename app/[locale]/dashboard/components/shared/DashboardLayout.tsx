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
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Check if we're on a settings page
  const isSettingsPage = pathname?.startsWith("/dashboard/settings");

  // Track mount state to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Continuously save the current path if it's NOT a settings page
    // Use sessionStorage to persist across remounts
    if (pathname && !pathname.startsWith("/dashboard/settings")) {
      sessionStorage.setItem("dashboardReturnPath", pathname);
      console.log("Saved return path:", pathname);
    }

    setIsSettingsOpen(isSettingsPage);
  }, [pathname, isSettingsPage]);

  // Prevent body scrolling when modal is open
  // Only run after component is mounted to prevent hydration mismatches
  useEffect(() => {
    if (!isMounted) return;

    if (isSettingsOpen) {
      // Save the current overflow style
      const originalOverflow = document.body.style.overflow;
      // Disable body scrolling
      document.body.style.overflow = "hidden";

      // Cleanup: restore original overflow when modal closes
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isSettingsOpen, isMounted]);

  return (
    <div className="min-h-screen">
      <DashboardNavbar />
      <Sidebar
        userRole={userRole}
        onSettingsClick={() => {
          // Redirect to appropriate settings section based on role
          if (userRole === "customer") {
            router.push("/dashboard/settings/profile");
          } else {
            router.push("/dashboard/settings/store");
          }
        }}
      />
      <main className="pl-56 pt-14">
        <div className="p-6">{children}</div>
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          // Only redirect if we're currently on a settings page
          if (pathname?.startsWith("/dashboard/settings")) {
            // Get the saved return path from sessionStorage
            const savedPath = sessionStorage.getItem("dashboardReturnPath");
            const destination = savedPath || "/dashboard";
            console.log(
              "Closing settings, saved return path:",
              savedPath,
              "destination:",
              destination
            );

            // Update URL immediately using window.history to prevent brief flash of settings page
            // This ensures the URL changes synchronously before React re-renders
            const currentLocale =
              window.location.pathname.split("/")[1] || "en";
            const newPath = `/${currentLocale}${destination}`;
            window.history.replaceState(null, "", newPath);

            // Use replace to let Next.js router handle the actual navigation
            // The useEffect watching isSettingsPage will close the modal when pathname changes
            router.replace(destination);
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
