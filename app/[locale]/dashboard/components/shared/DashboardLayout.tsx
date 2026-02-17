"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DashboardNavbar } from "./DashboardNavbar";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";

const MOBILE_BREAKPOINT = 860;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: "admin" | "seller" | "customer";
}

export function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();

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

  // Prevent body scrolling only when settings MODAL is open (desktop overlay).
  // On mobile, settings is a full page so we must NOT lock body scroll.
  useEffect(() => {
    if (!isMounted) return;

    if (isDesktop && isSettingsOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDesktop, isSettingsOpen, isMounted]);

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNavbar userRole={userRole} />
      {/* Sidebar: desktop only; mobile uses drawer in navbar */}
      <Sidebar
        userRole={userRole}
        onSettingsClick={() => {
          if (userRole === "customer") {
            router.push("/dashboard/settings/profile");
          } else {
            router.push("/dashboard/settings/store");
          }
        }}
      />
      <main className="pt-14 pl-0 md:pl-56 min-w-0 flex-1 flex flex-col min-h-0">
        <div className="p-4 md:p-6 min-w-0 flex-1 overflow-x-auto overflow-y-visible">
          {children}
        </div>
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
