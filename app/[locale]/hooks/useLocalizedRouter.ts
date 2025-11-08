"use client";

import { useRouter } from "@/i18n/navigation";

/**
 * Hook that provides a locale-aware router.push method
 * The router from next-intl navigation already handles locale automatically
 */
export function useLocalizedRouter() {
  const router = useRouter();

  return { push: router.push };
}
