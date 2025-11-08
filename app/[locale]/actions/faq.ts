"use server";

import { db } from "@/db";
import {
  faqSections,
  faqItems,
  faqSectionTranslations,
  faqItemTranslations,
} from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";
import { translateText } from "@/lib/translate";

// Helper function to translate text to all locales
async function translateToAllLocales(
  text: string | null | undefined
): Promise<Record<string, string | null>> {
  if (!text) {
    return { en: null, fi: null, ne: null };
  }

  const translations: Record<string, string | null> = {
    en: text, // English is the source
  };

  try {
    translations.fi = await translateText(text, "fi");
  } catch (error) {
    console.error("Error translating to Finnish:", error);
    translations.fi = text; // Fallback to English
  }

  try {
    translations.ne = await translateText(text, "ne");
  } catch (error) {
    console.error("Error translating to Nepali:", error);
    translations.ne = text; // Fallback to English
  }

  return translations;
}

export interface ActionResponse {
  success: boolean;
  error?: string;
  result?: unknown;
}

// ===================================
// FAQ SECTIONS
// ===================================

export interface FaqSectionData {
  id: number;
  slug: string;
  title: string; // English title
  order: number;
  isVisible: boolean;
  itemsCount: number;
}

export interface FaqSectionWithItems extends FaqSectionData {
  items: FaqItemData[];
}

export interface CreateFaqSectionInput {
  slug: string;
  title: string; // English title
  order?: number;
  isVisible?: boolean;
}

export interface UpdateFaqSectionInput {
  id: number;
  slug?: string;
  title?: string; // English title
  order?: number;
  isVisible?: boolean;
}

// Get all FAQ sections (for admin)
export async function getAllFaqSections(): Promise<
  ActionResponse & { result?: FaqSectionData[] }
> {
  try {
    await getCurrentAdmin();

    const sections = await db
      .select({
        id: faqSections.id,
        slug: faqSections.slug,
        order: faqSections.order,
        isVisible: faqSections.isVisible,
        title: faqSectionTranslations.title,
      })
      .from(faqSections)
      .leftJoin(
        faqSectionTranslations,
        and(
          eq(faqSectionTranslations.sectionId, faqSections.id),
          eq(faqSectionTranslations.locale, "en")
        )
      )
      .orderBy(asc(faqSections.order), asc(faqSections.id));

    // Count items for each section
    const sectionsWithCounts = await Promise.all(
      sections.map(async (section) => {
        const itemsCount = await db
          .select({ count: faqItems.id })
          .from(faqItems)
          .where(eq(faqItems.sectionId, section.id));

        return {
          id: section.id,
          slug: section.slug,
          title: section.title || "",
          order: section.order || 0,
          isVisible: section.isVisible ?? true,
          itemsCount: itemsCount.length,
        };
      })
    );

    return { success: true, result: sectionsWithCounts };
  } catch (error) {
    console.error("Error fetching FAQ sections:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch FAQ sections",
    };
  }
}

// Get FAQ section with items (for admin)
export async function getFaqSectionWithItems(
  sectionId: number
): Promise<ActionResponse & { result?: FaqSectionWithItems }> {
  try {
    await getCurrentAdmin();

    const section = await db
      .select({
        id: faqSections.id,
        slug: faqSections.slug,
        order: faqSections.order,
        isVisible: faqSections.isVisible,
        title: faqSectionTranslations.title,
      })
      .from(faqSections)
      .leftJoin(
        faqSectionTranslations,
        and(
          eq(faqSectionTranslations.sectionId, faqSections.id),
          eq(faqSectionTranslations.locale, "en")
        )
      )
      .where(eq(faqSections.id, sectionId))
      .limit(1);

    if (section.length === 0) {
      return { success: false, error: "FAQ section not found" };
    }

    const sectionData = section[0];

    // Get items for this section
    const items = await db
      .select({
        id: faqItems.id,
        order: faqItems.order,
        isVisible: faqItems.isVisible,
        question: faqItemTranslations.question,
        answer: faqItemTranslations.answer,
      })
      .from(faqItems)
      .leftJoin(
        faqItemTranslations,
        and(
          eq(faqItemTranslations.itemId, faqItems.id),
          eq(faqItemTranslations.locale, "en")
        )
      )
      .where(eq(faqItems.sectionId, sectionId))
      .orderBy(asc(faqItems.order), asc(faqItems.id));

    return {
      success: true,
      result: {
        id: sectionData.id,
        slug: sectionData.slug,
        title: sectionData.title || "",
        order: sectionData.order || 0,
        isVisible: sectionData.isVisible ?? true,
        itemsCount: items.length,
        items: items.map((item) => ({
          id: item.id,
          sectionId: sectionData.id,
          question: item.question || "",
          answer: item.answer || "",
          order: item.order || 0,
          isVisible: item.isVisible ?? true,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching FAQ section:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch FAQ section",
    };
  }
}

// Create FAQ section
export async function createFaqSection(
  input: CreateFaqSectionInput
): Promise<ActionResponse & { result?: FaqSectionData }> {
  try {
    await getCurrentAdmin();

    // Translate title to all locales
    const titleTranslations = await translateToAllLocales(input.title);

    // Insert base section
    const [newSection] = await db
      .insert(faqSections)
      .values({
        slug: input.slug,
        order: input.order ?? 0,
        isVisible: input.isVisible ?? true,
      })
      .returning();

    // Insert translations for all locales
    const locales = ["en", "fi", "ne"] as const;
    await Promise.all(
      locales.map((locale) =>
        db.insert(faqSectionTranslations).values({
          sectionId: newSection.id,
          locale,
          title: titleTranslations[locale] || input.title,
        })
      )
    );

    return {
      success: true,
      result: {
        id: newSection.id,
        slug: newSection.slug,
        title: input.title,
        order: newSection.order || 0,
        isVisible: newSection.isVisible ?? true,
        itemsCount: 0,
      },
    };
  } catch (error) {
    console.error("Error creating FAQ section:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create FAQ section",
    };
  }
}

// Update FAQ section
export async function updateFaqSection(
  input: UpdateFaqSectionInput
): Promise<ActionResponse & { result?: FaqSectionData }> {
  try {
    await getCurrentAdmin();

    const updateData: {
      slug?: string;
      order?: number;
      isVisible?: boolean;
    } = {};

    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.isVisible !== undefined) updateData.isVisible = input.isVisible;

    // Update base section if needed
    if (Object.keys(updateData).length > 0) {
      await db
        .update(faqSections)
        .set(updateData)
        .where(eq(faqSections.id, input.id));
    }

    // Update title translations if provided
    if (input.title !== undefined) {
      const titleTranslations = await translateToAllLocales(input.title);

      const locales = ["en", "fi", "ne"] as const;
      await Promise.all(
        locales.map(async (locale) => {
          const existing = await db
            .select()
            .from(faqSectionTranslations)
            .where(
              and(
                eq(faqSectionTranslations.sectionId, input.id),
                eq(faqSectionTranslations.locale, locale)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(faqSectionTranslations)
              .set({ title: titleTranslations[locale] || input.title })
              .where(
                and(
                  eq(faqSectionTranslations.sectionId, input.id),
                  eq(faqSectionTranslations.locale, locale)
                )
              );
          } else {
            const titleValue = titleTranslations[locale] || input.title;
            if (titleValue) {
              await db.insert(faqSectionTranslations).values({
                sectionId: input.id,
                locale,
                title: titleValue,
              });
            }
          }
        })
      );
    }

    // Fetch updated section
    const updated = await getAllFaqSections();
    const section = updated.result?.find((s) => s.id === input.id);

    if (!section) {
      return { success: false, error: "FAQ section not found after update" };
    }

    return { success: true, result: section };
  } catch (error) {
    console.error("Error updating FAQ section:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update FAQ section",
    };
  }
}

// Delete FAQ section
export async function deleteFaqSection(
  sectionId: number
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    await db.delete(faqSections).where(eq(faqSections.id, sectionId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting FAQ section:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete FAQ section",
    };
  }
}

// ===================================
// FAQ ITEMS
// ===================================

export interface FaqItemData {
  id: number;
  sectionId: number;
  question: string; // English question
  answer: string; // English answer
  order: number;
  isVisible: boolean;
}

export interface CreateFaqItemInput {
  sectionId: number;
  question: string; // English question
  answer: string; // English answer
  order?: number;
  isVisible?: boolean;
}

export interface UpdateFaqItemInput {
  id: number;
  question?: string; // English question
  answer?: string; // English answer
  order?: number;
  isVisible?: boolean;
}

// Create FAQ item
export async function createFaqItem(
  input: CreateFaqItemInput
): Promise<ActionResponse & { result?: FaqItemData }> {
  try {
    await getCurrentAdmin();

    // Translate question and answer to all locales
    const questionTranslations = await translateToAllLocales(input.question);
    const answerTranslations = await translateToAllLocales(input.answer);

    // Insert base item
    const [newItem] = await db
      .insert(faqItems)
      .values({
        sectionId: input.sectionId,
        order: input.order ?? 0,
        isVisible: input.isVisible ?? true,
      })
      .returning();

    // Insert translations for all locales
    const locales = ["en", "fi", "ne"] as const;
    await Promise.all(
      locales.map((locale) => {
        const question = questionTranslations[locale] || input.question;
        const answer = answerTranslations[locale] || input.answer;
        if (question && answer) {
          return db.insert(faqItemTranslations).values({
            itemId: newItem.id,
            locale,
            question,
            answer,
          });
        }
        return Promise.resolve();
      })
    );

    return {
      success: true,
      result: {
        id: newItem.id,
        sectionId: newItem.sectionId,
        question: input.question,
        answer: input.answer,
        order: newItem.order || 0,
        isVisible: newItem.isVisible ?? true,
      },
    };
  } catch (error) {
    console.error("Error creating FAQ item:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create FAQ item",
    };
  }
}

// Update FAQ item
export async function updateFaqItem(
  input: UpdateFaqItemInput
): Promise<ActionResponse & { result?: FaqItemData }> {
  try {
    await getCurrentAdmin();

    const updateData: {
      order?: number;
      isVisible?: boolean;
    } = {};

    if (input.order !== undefined) updateData.order = input.order;
    if (input.isVisible !== undefined) updateData.isVisible = input.isVisible;

    // Update base item if needed
    if (Object.keys(updateData).length > 0) {
      await db
        .update(faqItems)
        .set(updateData)
        .where(eq(faqItems.id, input.id));
    }

    // Update question translations if provided
    if (input.question !== undefined) {
      const questionTranslations = await translateToAllLocales(input.question);

      const locales = ["en", "fi", "ne"] as const;
      await Promise.all(
        locales.map(async (locale) => {
          const existing = await db
            .select()
            .from(faqItemTranslations)
            .where(
              and(
                eq(faqItemTranslations.itemId, input.id),
                eq(faqItemTranslations.locale, locale)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(faqItemTranslations)
              .set({
                question: questionTranslations[locale] || input.question,
              })
              .where(
                and(
                  eq(faqItemTranslations.itemId, input.id),
                  eq(faqItemTranslations.locale, locale)
                )
              );
          } else {
            const questionValue =
              questionTranslations[locale] || input.question;
            if (questionValue) {
              await db.insert(faqItemTranslations).values({
                itemId: input.id,
                locale,
                question: questionValue,
                answer: "", // Will be updated if answer is also provided
              });
            }
          }
        })
      );
    }

    // Update answer translations if provided
    if (input.answer !== undefined) {
      const answerTranslations = await translateToAllLocales(input.answer);

      const locales = ["en", "fi", "ne"] as const;
      await Promise.all(
        locales.map(async (locale) => {
          const existing = await db
            .select()
            .from(faqItemTranslations)
            .where(
              and(
                eq(faqItemTranslations.itemId, input.id),
                eq(faqItemTranslations.locale, locale)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(faqItemTranslations)
              .set({
                answer: answerTranslations[locale] || input.answer,
              })
              .where(
                and(
                  eq(faqItemTranslations.itemId, input.id),
                  eq(faqItemTranslations.locale, locale)
                )
              );
          } else {
            const answerValue = answerTranslations[locale] || input.answer;
            if (answerValue) {
              await db.insert(faqItemTranslations).values({
                itemId: input.id,
                locale,
                question: "", // Will be updated if question is also provided
                answer: answerValue,
              });
            }
          }
        })
      );
    }

    // Fetch updated item
    const item = await db
      .select({
        id: faqItems.id,
        sectionId: faqItems.sectionId,
        order: faqItems.order,
        isVisible: faqItems.isVisible,
        question: faqItemTranslations.question,
        answer: faqItemTranslations.answer,
      })
      .from(faqItems)
      .leftJoin(
        faqItemTranslations,
        and(
          eq(faqItemTranslations.itemId, faqItems.id),
          eq(faqItemTranslations.locale, "en")
        )
      )
      .where(eq(faqItems.id, input.id))
      .limit(1);

    if (item.length === 0) {
      return { success: false, error: "FAQ item not found after update" };
    }

    return {
      success: true,
      result: {
        id: item[0].id,
        sectionId: item[0].sectionId,
        question: item[0].question || "",
        answer: item[0].answer || "",
        order: item[0].order || 0,
        isVisible: item[0].isVisible ?? true,
      },
    };
  } catch (error) {
    console.error("Error updating FAQ item:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update FAQ item",
    };
  }
}

// Delete FAQ item
export async function deleteFaqItem(itemId: number): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    await db.delete(faqItems).where(eq(faqItems.id, itemId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting FAQ item:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete FAQ item",
    };
  }
}

// ===================================
// PUBLIC FAQ (No admin required)
// ===================================

export interface PublicFaqSection {
  id: number;
  slug: string;
  title: string;
  items: PublicFaqItem[];
}

export interface PublicFaqItem {
  id: number;
  question: string;
  answer: string;
}

// Get public FAQ data (for homepage display)
export async function getPublicFaq(
  locale: string = "en"
): Promise<ActionResponse & { result?: PublicFaqSection[] }> {
  try {
    // Fetch all visible sections with translations
    const sections = await db
      .select({
        id: faqSections.id,
        slug: faqSections.slug,
        order: faqSections.order,
        isVisible: faqSections.isVisible,
        title: faqSectionTranslations.title,
      })
      .from(faqSections)
      .leftJoin(
        faqSectionTranslations,
        and(
          eq(faqSectionTranslations.sectionId, faqSections.id),
          eq(faqSectionTranslations.locale, locale)
        )
      )
      .where(eq(faqSections.isVisible, true))
      .orderBy(asc(faqSections.order));

    // If no translations found for current locale, try English as fallback
    const sectionsWithFallback = await Promise.all(
      sections.map(async (section) => {
        let title = section.title;

        // If no translation for current locale, fetch English
        if (!title && locale !== "en") {
          const enSection = await db
            .select({
              title: faqSectionTranslations.title,
            })
            .from(faqSectionTranslations)
            .where(
              and(
                eq(faqSectionTranslations.sectionId, section.id),
                eq(faqSectionTranslations.locale, "en")
              )
            )
            .limit(1);

          title = enSection[0]?.title || null;
        }

        // Fetch items for this section
        const items = await db
          .select({
            id: faqItems.id,
            order: faqItems.order,
            isVisible: faqItems.isVisible,
            question: faqItemTranslations.question,
            answer: faqItemTranslations.answer,
          })
          .from(faqItems)
          .leftJoin(
            faqItemTranslations,
            and(
              eq(faqItemTranslations.itemId, faqItems.id),
              eq(faqItemTranslations.locale, locale)
            )
          )
          .where(
            and(
              eq(faqItems.sectionId, section.id),
              eq(faqItems.isVisible, true)
            )
          )
          .orderBy(asc(faqItems.order));

        // Fallback to English for items if needed
        const itemsWithFallback = await Promise.all(
          items.map(async (item) => {
            let question = item.question;
            let answer = item.answer;

            // If no translation for current locale, fetch English
            if ((!question || !answer) && locale !== "en") {
              const enItem = await db
                .select({
                  question: faqItemTranslations.question,
                  answer: faqItemTranslations.answer,
                })
                .from(faqItemTranslations)
                .where(
                  and(
                    eq(faqItemTranslations.itemId, item.id),
                    eq(faqItemTranslations.locale, "en")
                  )
                )
                .limit(1);

              question = question || enItem[0]?.question || "";
              answer = answer || enItem[0]?.answer || "";
            }

            return {
              id: item.id,
              question: question || "",
              answer: answer || "",
            };
          })
        );

        return {
          id: section.id,
          slug: section.slug,
          title: title || "",
          items: itemsWithFallback.filter(
            (item) => item.question && item.answer
          ),
        };
      })
    );

    return {
      success: true,
      result: sectionsWithFallback.filter(
        (section) => section.title && section.items.length > 0
      ),
    };
  } catch (error) {
    console.error("Error fetching public FAQ:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch FAQ",
    };
  }
}
