import { Translate } from "@google-cloud/translate/build/src/v2";

export const translateText = async (
  text: string,
  target: string
): Promise<string> => {
  // Map language codes to Google Translate codes
  const langMap: Record<string, string> = {
    en: "en",
    fi: "fi",
    ne: "ne", // Nepali
  };

  const targetLang = langMap[target] || target;

  const client = new Translate({
    key: process.env.GOOGLE_TRANSLATE_API_KEY!,
  });

  const [translation] = await client.translate(text, targetLang);
  return translation as string;
};
