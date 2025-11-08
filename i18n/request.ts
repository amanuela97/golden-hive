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
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  // Try to load from database first
  const { getTranslation } = await import(
    "../app/[locale]/actions/translations"
  );

  let englishMessages: Messages | null = null;
  let localeMessages: Messages | null = null;

  try {
    // Try to get from DB
    englishMessages = await getTranslation("en");
    if (locale !== "en") {
      localeMessages = await getTranslation(locale);
    }
  } catch (error) {
    console.error("Error loading translations from DB:", error);
  }

  // Fallback to static JSON files if DB doesn't have translations
  if (!englishMessages) {
    try {
      englishMessages = (await import(`@/locales/en/common.json`)).default;
    } catch (error) {
      console.error("Error loading fallback English translations:", error);
      englishMessages = {};
    }
  }

  // If locale is English, return directly
  if (locale === "en") {
    return {
      locale,
      messages: englishMessages || {},
    };
  }

  // Load locale-specific messages from static files if not in DB
  if (!localeMessages) {
    try {
      localeMessages = (await import(`@/locales/${locale}/common.json`))
        .default;
    } catch (error) {
      console.error(`Error loading fallback ${locale} translations:`, error);
      localeMessages = {};
    }
  }

  // Merge English messages (fallback) with locale-specific messages
  // Locale messages take precedence, but English fills in missing keys
  const mergedMessages = deepMerge(englishMessages || {}, localeMessages || {});

  return {
    locale,
    messages: mergedMessages,
  };
});
