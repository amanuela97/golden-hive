"use client";

import { usePathname } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const NavbarServer = dynamic(() => import("./NavbarServer"), {
  ssr: true,
});

export default function ConditionalNavbarWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isDashboard, setIsDashboard] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if we're on a dashboard route
    const currentPath = pathname || window.location.pathname;
    // Remove locale prefix if present (e.g., /en/dashboard -> /dashboard)
    const pathWithoutLocale =
      currentPath.replace(/^\/(en|fi|ne)/, "") || currentPath;
    setIsDashboard(pathWithoutLocale.startsWith("/dashboard"));
  }, [pathname]);

  // Hide navbar on dashboard routes
  if (mounted && isDashboard) {
    return null;
  }

  // During SSR or before mount, check pathname directly
  if (!mounted) {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      const pathWithoutLocale =
        currentPath.replace(/^\/(en|fi|ne)/, "") || currentPath;
      if (pathWithoutLocale.startsWith("/dashboard")) {
        return null;
      }
    }
  }

  return <NavbarServer />;
}
