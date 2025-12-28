"use client";

import { usePathname } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { MarketplaceHeader } from "./marketplace-header";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if we're on a dashboard route
    // usePathname from next-intl returns path without locale (e.g., "/dashboard")
    const currentPath = pathname || "";
    
    if (currentPath.startsWith("/dashboard")) {
      setShouldRender(false);
    } else {
      setShouldRender(true);
    }
  }, [pathname]);

  // During SSR or before mount, don't render to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Don't render navbar on dashboard routes
  if (!shouldRender) {
    return null;
  }

  // Use MarketplaceHeader instead of Navbar
  return <MarketplaceHeader />;
}
