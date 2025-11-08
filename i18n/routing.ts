import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fi", "ne"],
  defaultLocale: "en",
  localePrefix: "always", // Always show locale prefix for consistency
  localeDetection: false, // Disable automatic browser locale detection
});
