import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = Record<string, any>;

/**
 * Deep merge function to merge English messages as fallback
 */
function deepMerge(target: Messages, source: Messages): Messages {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(
            target[key] as Messages,
            source[key] as Messages
          );
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item: unknown): item is Messages {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  // Load from static JSON only — no DB on every request (major render-time improvement).
  // Admin-editable translations can be loaded in specific pages that need them.
  let englishMessages: Messages = {};
  try {
    englishMessages =
      (await import(`@/locales/en/common.json`)).default ?? {};
  } catch (error) {
    console.error("Error loading English translations:", error);
  }

  if (locale === "en") {
    return { locale, messages: englishMessages };
  }

  let localeMessages: Messages = {};
  try {
    localeMessages =
      (await import(`@/locales/${locale}/common.json`)).default ?? {};
  } catch (error) {
    console.error(`Error loading ${locale} translations:`, error);
  }

  const mergedMessages = deepMerge(englishMessages, localeMessages);
  return { locale, messages: mergedMessages };
});
