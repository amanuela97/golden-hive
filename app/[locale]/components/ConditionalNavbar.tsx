"use client";

import { usePathname } from "@/i18n/navigation";
import { MarketplaceHeader } from "./marketplace-header";

export default function ConditionalNavbar() {
  const pathname = usePathname();

  // Render immediately - pathname will be available on client
  // For SSR, we'll render the header and let client-side handle hiding it
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return <MarketplaceHeader />;
}
