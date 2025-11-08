"use server";

import { db } from "@/db";
import { translations, type TranslationData } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";
import { unstable_cache, revalidateTag } from "next/cache";
import { translateText } from "@/lib/translate";

// Cache translations for 1 hour
// Note: We need to create separate cached functions for each language
// because unstable_cache doesn't support dynamic tags in the function itself
async function _getTranslationFromDB(
  lang: string
): Promise<TranslationData | null> {
  const result = await db
    .select()
    .from(translations)
    .where(eq(translations.lang, lang))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].data as TranslationData;
}

export const getTranslation = async (
  lang: string
): Promise<TranslationData | null> => {
  // Use unstable_cache with language-specific tags
  if (lang === "en") {
    return unstable_cache(
      () => _getTranslationFromDB("en"),
      ["translation-en"],
      { tags: ["translation-en"], revalidate: 3600 }
    )();
  } else if (lang === "fi") {
    return unstable_cache(
      () => _getTranslationFromDB("fi"),
      ["translation-fi"],
      { tags: ["translation-fi"], revalidate: 3600 }
    )();
  } else if (lang === "ne") {
    return unstable_cache(
      () => _getTranslationFromDB("ne"),
      ["translation-ne"],
      { tags: ["translation-ne"], revalidate: 3600 }
    )();
  }
  return null;
};

// Get all translations (admin only)
export async function getAllTranslations(): Promise<
  Record<string, TranslationData>
> {
  await getCurrentAdmin();

  const allTranslations = await db.select().from(translations);

  const result: Record<string, TranslationData> = {};
  for (const t of allTranslations) {
    result[t.lang] = t.data as TranslationData;
  }

  return result;
}

// Get translation for a specific language (admin only)
export async function getTranslationByLang(
  lang: string
): Promise<TranslationData | null> {
  await getCurrentAdmin();

  const result = await db
    .select()
    .from(translations)
    .where(eq(translations.lang, lang))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].data as TranslationData;
}

// Save/Update translation (admin only)
export async function saveTranslation(
  lang: string,
  data: TranslationData
): Promise<{ success: boolean; error?: string }> {
  try {
    await getCurrentAdmin();

    // Validate lang
    const validLangs = ["en", "fi", "ne"];
    if (!validLangs.includes(lang)) {
      return { success: false, error: "Invalid language code" };
    }

    // Validate data is an object
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { success: false, error: "Invalid translation data" };
    }

    // UPSERT translation
    await db
      .insert(translations)
      .values({
        lang,
        data: data as TranslationData,
      })
      .onConflictDoUpdate({
        target: translations.lang,
        set: {
          data: data as TranslationData,
          updatedAt: new Date(),
        },
      });

    // Revalidate cache
    revalidateTag(`translation-${lang}`);
    revalidateTag("translations");

    return { success: true };
  } catch (error) {
    console.error("Error saving translation:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save translation",
    };
  }
}

// Helper function to recursively translate nested JSON object
async function translateNestedObject(
  obj: string | TranslationData | TranslationData[],
  targetLang: string,
  sourceLang: string = "en"
): Promise<string | TranslationData | TranslationData[]> {
  if (typeof obj === "string") {
    // Translate string values
    try {
      const translated = await translateText(obj, targetLang);
      return translated;
    } catch (error) {
      console.error("Translation error:", error);
      return obj; // Return original if translation fails
    }
  } else if (Array.isArray(obj)) {
    // Translate array elements
    return Promise.all(
      obj.map((item) => translateNestedObject(item, targetLang, sourceLang))
    ) as Promise<TranslationData[]>;
  } else if (obj && typeof obj === "object") {
    // Recursively translate object properties
    const translated: TranslationData = {};
    for (const [key, value] of Object.entries(obj)) {
      translated[key] = (await translateNestedObject(
        value,
        targetLang,
        sourceLang
      )) as string | Record<string, string | Record<string, string>>;
    }
    return translated;
  } else {
    // Return non-string primitives as-is
    return obj;
  }
}

// Helper function to get nested value by path (e.g., "nav.home" -> obj.nav.home)
function getNestedValue(
  obj: TranslationData,
  path: string
): string | undefined {
  const keys = path.split(".");
  let current:
    | string
    | Record<string, string | Record<string, string>>
    | TranslationData = obj;
  for (const key of keys) {
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      key in current
    ) {
      const next: string | Record<string, string | Record<string, string>> = (
        current as TranslationData
      )[key];
      if (
        typeof next === "string" ||
        (typeof next === "object" && !Array.isArray(next))
      ) {
        current = next;
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

// Helper function to set nested value by path (preserves existing nested keys)
function setNestedValue(
  obj: TranslationData,
  path: string,
  value: string
): void {
  const keys = path.split(".");
  let current: TranslationData = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const currentValue = current[key];
    if (
      !(key in current) ||
      typeof currentValue !== "object" ||
      Array.isArray(currentValue)
    ) {
      current[key] = {};
    }
    current = current[key] as TranslationData;
  }
  // Set the final value without overwriting the parent object
  current[keys[keys.length - 1]] = value;
}

// Translate only specific keys from English to target language
export async function translateModifiedKeys(
  targetLang: string,
  modifiedKeys: string[]
): Promise<{ success: boolean; data?: TranslationData; error?: string }> {
  try {
    await getCurrentAdmin();

    const validLangs = ["fi", "ne"];
    if (!validLangs.includes(targetLang)) {
      return { success: false, error: "Invalid target language" };
    }

    if (modifiedKeys.length === 0) {
      return { success: true, data: {} };
    }

    // Check if Google Translate API key is configured
    if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
      return {
        success: false,
        error: "Google Translate API key is not configured. Please set GOOGLE_TRANSLATE_API_KEY in your environment variables.",
      };
    }

    // Get English translation
    const enTranslation = await getTranslationByLang("en");
    if (!enTranslation) {
      return {
        success: false,
        error: "English translation not found. Please create it first.",
      };
    }

    // Get existing target language translation
    const existingTranslation = await getTranslationByLang(targetLang);
    const result: TranslationData = existingTranslation
      ? { ...existingTranslation }
      : {};

    // Translate only the modified keys
    const translationErrors: string[] = [];
    const translationPromises = modifiedKeys.map(async (keyPath) => {
      const englishValue = getNestedValue(enTranslation, keyPath);
      if (englishValue && englishValue.trim()) {
        try {
          const translated = await translateText(englishValue, targetLang);
          if (translated && translated.trim()) {
            setNestedValue(result, keyPath, translated);
          } else {
            // Translation returned empty, keep English
            const existingValue = getNestedValue(result, keyPath);
            if (!existingValue) {
              setNestedValue(result, keyPath, englishValue);
            }
            translationErrors.push(`${keyPath}: Empty translation`);
          }
        } catch (error) {
          console.error(`Error translating key ${keyPath}:`, error);
          translationErrors.push(
            `${keyPath}: ${error instanceof Error ? error.message : "Translation failed"}`
          );
          // Keep existing translation if available, otherwise use English
          const existingValue = getNestedValue(result, keyPath);
          if (!existingValue) {
            setNestedValue(result, keyPath, englishValue);
          }
        }
      } else {
        translationErrors.push(`${keyPath}: Empty or invalid English value`);
      }
    });

    await Promise.all(translationPromises);

    // If all translations failed, return error
    if (translationErrors.length === modifiedKeys.length) {
      return {
        success: false,
        error: `All translations failed. Errors: ${translationErrors.join("; ")}`,
      };
    }

    // If some translations failed, still return success but log warnings
    if (translationErrors.length > 0) {
      console.warn(
        `Some translations failed (${translationErrors.length}/${modifiedKeys.length}):`,
        translationErrors
      );
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Error translating modified keys:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to translate keys";
    
    // Provide more specific error messages
    if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
      return {
        success: false,
        error: "Google Translate API authentication failed. Please check your API key.",
      };
    }
    if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      return {
        success: false,
        error: "Google Translate API quota exceeded. Please check your usage limits.",
      };
    }

    return {
      success: false,
      error: `Failed to translate keys: ${errorMessage}`,
    };
  }
}

// Translate English JSON to target language (admin only)
export async function translateToLanguage(
  targetLang: string
): Promise<{ success: boolean; data?: TranslationData; error?: string }> {
  try {
    await getCurrentAdmin();

    const validLangs = ["fi", "ne"];
    if (!validLangs.includes(targetLang)) {
      return { success: false, error: "Invalid target language" };
    }

    // Check if Google Translate API key is configured
    if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
      return {
        success: false,
        error: "Google Translate API key is not configured. Please set GOOGLE_TRANSLATE_API_KEY in your environment variables.",
      };
    }

    // Get English translation
    const enTranslation = await getTranslationByLang("en");
    if (!enTranslation) {
      return {
        success: false,
        error: "English translation not found. Please create it first.",
      };
    }

    // Translate the entire JSON object
    const translated = await translateNestedObject(enTranslation, targetLang);

    return { success: true, data: translated as TranslationData };
  } catch (error) {
    console.error("Error translating:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to translate";
    
    // Provide more specific error messages
    if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
      return {
        success: false,
        error: "Google Translate API authentication failed. Please check your API key.",
      };
    }
    if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
      return {
        success: false,
        error: "Google Translate API quota exceeded. Please check your usage limits.",
      };
    }

    return {
      success: false,
      error: `Failed to translate: ${errorMessage}`,
    };
  }
}
