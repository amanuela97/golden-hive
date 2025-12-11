"use client";

import { usePathname } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { Footer } from "./footer";

export default function ConditionalFooter() {
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

  // Don't render footer on dashboard routes
  if (!shouldRender) {
    return null;
  }

  // Use the static Footer component for now
  // If you need dynamic footer data, you can create an API route and fetch it here
  return <Footer />;
}
