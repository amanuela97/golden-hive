"use client";

import { usePathname } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Only load FooterServer on client side and when not on dashboard
const FooterServer = dynamic(() => import("./FooterServer"), {
  ssr: false, // Disable SSR to avoid potential issues
});

export default function ConditionalFooterWrapper() {
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Check if we're on a dashboard route
    // usePathname from next-intl returns path without locale (e.g., "/dashboard")
    const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname.replace(/^\/(en|fi|ne)/, "") : "");
    
    if (currentPath.startsWith("/dashboard")) {
      setShouldRender(false);
    } else {
      setShouldRender(true);
    }
  }, [pathname]);

  // Don't render footer on dashboard routes
  if (!shouldRender) {
    return null;
  }

  return <FooterServer />;
}

