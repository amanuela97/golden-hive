"use client";

import { usePathname } from "@/i18n/navigation";
import { Footer } from "./footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  
  // Render immediately - pathname will be available on client
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return <Footer />;
}
