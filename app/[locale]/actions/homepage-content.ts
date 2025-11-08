"use server";

import { db } from "@/db";
import {
  homepageHero,
  homepageAbout,
  homepageBenefits,
  homepageHeroTranslations,
  homepageAboutTranslations,
  homepageBenefitTranslations,
} from "@/db/schema";
import { eq, asc, ne, and, inArray } from "drizzle-orm";
import { deleteFile, uploadFile } from "@/lib/cloudinary";
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

// Helper function to translate benefit items array
async function translateBenefitItems(
  items:
    | Array<{ icon: string; title: string; description: string }>
    | null
    | undefined
): Promise<
  Record<
    string,
    Array<{ icon: string; title: string; description: string }> | null
  >
> {
  if (!items || items.length === 0) {
    return { en: null, fi: null, ne: null };
  }

  const translations: Record<
    string,
    Array<{ icon: string; title: string; description: string }> | null
  > = {
    en: items, // English is the source
  };

  try {
    const fiItems = await Promise.all(
      items.map(async (item) => ({
        icon: item.icon, // Icon doesn't need translation
        title: await translateText(item.title, "fi"),
        description: await translateText(item.description, "fi"),
      }))
    );
    translations.fi = fiItems;
  } catch (error) {
    console.error("Error translating benefit items to Finnish:", error);
    translations.fi = items; // Fallback to English
  }

  try {
    const neItems = await Promise.all(
      items.map(async (item) => ({
        icon: item.icon, // Icon doesn't need translation
        title: await translateText(item.title, "ne"),
        description: await translateText(item.description, "ne"),
      }))
    );
    translations.ne = neItems;
  } catch (error) {
    console.error("Error translating benefit items to Nepali:", error);
    translations.ne = items; // Fallback to English
  }

  return translations;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

// Hero Section Actions
export interface HeroSlide {
  id: string;
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaLink?: string | null;
  order: number;
  isActive: boolean;
}

export interface CreateHeroSlideData {
  imageUrl?: string;
  imageFile?: File;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaLink?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateHeroSlideData extends Partial<CreateHeroSlideData> {
  id: string;
}

export async function getAllHeroSlides(): Promise<
  ActionResponse & { result?: HeroSlide[] }
> {
  try {
    await getCurrentAdmin();

    // Fetch hero slides with English translations (admin dashboard uses English)
    const slides = await db
      .select({
        id: homepageHero.id,
        imageUrl: homepageHero.imageUrl,
        ctaLink: homepageHero.ctaLink,
        order: homepageHero.order,
        isActive: homepageHero.isActive,
        title: homepageHeroTranslations.title,
        subtitle: homepageHeroTranslations.subtitle,
        ctaLabel: homepageHeroTranslations.ctaLabel,
      })
      .from(homepageHero)
      .leftJoin(
        homepageHeroTranslations,
        and(
          eq(homepageHeroTranslations.heroId, homepageHero.id),
          eq(homepageHeroTranslations.locale, "en")
        )
      )
      .orderBy(asc(homepageHero.order));

    return {
      success: true,
      result: slides.map((s) => ({
        id: s.id,
        imageUrl: s.imageUrl,
        title: s.title ?? null,
        subtitle: s.subtitle ?? null,
        ctaLabel: s.ctaLabel ?? null,
        ctaLink: s.ctaLink ?? null,
        order: s.order ?? 0,
        isActive: s.isActive ?? true,
      })) as HeroSlide[],
    };
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch hero slides",
    };
  }
}

// Public version for homepage (no authentication required)
export async function getPublicHeroSlides(
  locale: string = "en"
): Promise<ActionResponse & { result?: HeroSlide[] }> {
  try {
    // If locale is English, just fetch English translations
    if (locale === "en") {
      const slides = await db
        .select({
          id: homepageHero.id,
          imageUrl: homepageHero.imageUrl,
          ctaLink: homepageHero.ctaLink,
          order: homepageHero.order,
          isActive: homepageHero.isActive,
          title: homepageHeroTranslations.title,
          subtitle: homepageHeroTranslations.subtitle,
          ctaLabel: homepageHeroTranslations.ctaLabel,
        })
        .from(homepageHero)
        .leftJoin(
          homepageHeroTranslations,
          and(
            eq(homepageHeroTranslations.heroId, homepageHero.id),
            eq(homepageHeroTranslations.locale, "en")
          )
        )
        .where(eq(homepageHero.isActive, true))
        .orderBy(asc(homepageHero.order));

      return {
        success: true,
        result: slides.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl,
          title: s.title ?? null,
          subtitle: s.subtitle ?? null,
          ctaLabel: s.ctaLabel ?? null,
          ctaLink: s.ctaLink ?? null,
          order: s.order ?? 0,
          isActive: s.isActive ?? true,
        })) as HeroSlide[],
      };
    }

    // For non-English locales, fetch both current locale and English (for fallback)
    // We'll use a subquery approach
    const slidesWithCurrentLocale = await db
      .select({
        id: homepageHero.id,
        imageUrl: homepageHero.imageUrl,
        ctaLink: homepageHero.ctaLink,
        order: homepageHero.order,
        isActive: homepageHero.isActive,
        title: homepageHeroTranslations.title,
        subtitle: homepageHeroTranslations.subtitle,
        ctaLabel: homepageHeroTranslations.ctaLabel,
      })
      .from(homepageHero)
      .leftJoin(
        homepageHeroTranslations,
        and(
          eq(homepageHeroTranslations.heroId, homepageHero.id),
          eq(homepageHeroTranslations.locale, locale)
        )
      )
      .where(eq(homepageHero.isActive, true))
      .orderBy(asc(homepageHero.order));

    // Fetch English translations for fallback
    const heroIds = slidesWithCurrentLocale.map((s) => s.id);
    const englishTranslations =
      heroIds.length > 0
        ? await db
            .select({
              heroId: homepageHeroTranslations.heroId,
              title: homepageHeroTranslations.title,
              subtitle: homepageHeroTranslations.subtitle,
              ctaLabel: homepageHeroTranslations.ctaLabel,
            })
            .from(homepageHeroTranslations)
            .where(
              and(
                eq(homepageHeroTranslations.locale, "en"),
                inArray(homepageHeroTranslations.heroId, heroIds)
              )
            )
        : [];

    // Create a map of English translations by heroId
    const enTranslationsMap = new Map(
      englishTranslations.map((t) => [t.heroId, t])
    );

    return {
      success: true,
      result: slidesWithCurrentLocale.map((s) => {
        const enTrans = enTranslationsMap.get(s.id);
        return {
          id: s.id,
          imageUrl: s.imageUrl,
          // Use current locale translation, fallback to English if not available
          title: s.title ?? enTrans?.title ?? null,
          subtitle: s.subtitle ?? enTrans?.subtitle ?? null,
          ctaLabel: s.ctaLabel ?? enTrans?.ctaLabel ?? null,
          ctaLink: s.ctaLink ?? null,
          order: s.order ?? 0,
          isActive: s.isActive ?? true,
        };
      }) as HeroSlide[],
    };
  } catch (error) {
    console.error("Error fetching public hero slides:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch hero slides",
    };
  }
}

export async function createHeroSlide(
  data: CreateHeroSlideData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    let imageUrl = data.imageUrl;

    // Upload image if file is provided
    if (data.imageFile) {
      imageUrl = await uploadFile(data.imageFile, "homepage/hero");
    }

    if (!imageUrl) {
      throw new Error("Image URL or file is required");
    }

    // Get the next available order number
    const getNextOrder = async (): Promise<number> => {
      const existingSlides = await db
        .select({ order: homepageHero.order })
        .from(homepageHero)
        .orderBy(asc(homepageHero.order));

      const requestedOrder = data.order || 0;

      // Check if the requested order is available
      const isOrderAvailable = !existingSlides.some(
        (slide) => slide.order === requestedOrder
      );

      if (isOrderAvailable) {
        return requestedOrder;
      }

      // Find the next available order number
      let nextOrder = requestedOrder;
      while (existingSlides.some((slide) => slide.order === nextOrder)) {
        nextOrder++;
      }

      return nextOrder;
    };

    const order = await getNextOrder();

    // Insert base hero slide (non-translatable fields only)
    const newSlide = await db
      .insert(homepageHero)
      .values({
        imageUrl,
        ctaLink: data.ctaLink || null,
        order,
        isActive: data.isActive ?? true,
      })
      .returning();

    // Translate and insert translations for all locales
    if (data.title || data.subtitle || data.ctaLabel) {
      const [titleTranslations, subtitleTranslations, ctaLabelTranslations] =
        await Promise.all([
          translateToAllLocales(data.title),
          translateToAllLocales(data.subtitle),
          translateToAllLocales(data.ctaLabel),
        ]);

      // Insert translations for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        await db.insert(homepageHeroTranslations).values({
          heroId: newSlide[0].id,
          locale: loc,
          title: titleTranslations[loc],
          subtitle: subtitleTranslations[loc],
          ctaLabel: ctaLabelTranslations[loc],
        });
      }
    }

    const message =
      order === (data.order || 0)
        ? "Hero slide created successfully"
        : `Hero slide created successfully (order adjusted to ${order} as ${data.order || 0} was already taken)`;

    return {
      success: true,
      message,
      result: newSlide[0],
    };
  } catch (error) {
    console.error("Error creating hero slide:", error);

    // Handle specific database errors
    if (
      error instanceof Error &&
      error.message.includes("duplicate key value violates unique constraint")
    ) {
      return {
        success: false,
        error:
          "A hero slide with this order number already exists. Please try a different order number.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create hero slide",
    };
  }
}

export async function updateHeroSlide(
  data: UpdateHeroSlideData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    const updateData: Partial<typeof homepageHero.$inferInsert> = {};

    // Handle image upload if file is provided
    if (data.imageFile) {
      updateData.imageUrl = await uploadFile(data.imageFile, "homepage/hero");
    } else if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
    }

    if (data.ctaLink !== undefined) updateData.ctaLink = data.ctaLink;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Handle order update with conflict resolution
    if (data.order !== undefined) {
      // Check if the requested order is already taken by another slide
      const existingSlide = await db
        .select({ id: homepageHero.id, order: homepageHero.order })
        .from(homepageHero)
        .where(eq(homepageHero.order, data.order))
        .limit(1);

      if (existingSlide.length > 0 && existingSlide[0].id !== data.id) {
        // Order is taken by another slide, find next available
        const allSlides = await db
          .select({ order: homepageHero.order })
          .from(homepageHero)
          .where(ne(homepageHero.id, data.id))
          .orderBy(asc(homepageHero.order));

        let nextOrder = data.order;
        while (allSlides.some((slide) => slide.order === nextOrder)) {
          nextOrder++;
        }

        updateData.order = nextOrder;
      } else {
        updateData.order = data.order;
      }
    }

    // Update base table
    const updatedSlide = await db
      .update(homepageHero)
      .set(updateData)
      .where(eq(homepageHero.id, data.id))
      .returning();

    if (updatedSlide.length === 0) {
      return {
        success: false,
        error: "Hero slide not found",
      };
    }

    // Translate and update/insert translations for all locales
    if (
      data.title !== undefined ||
      data.subtitle !== undefined ||
      data.ctaLabel !== undefined
    ) {
      const [titleTranslations, subtitleTranslations, ctaLabelTranslations] =
        await Promise.all([
          data.title !== undefined
            ? translateToAllLocales(data.title)
            : Promise.resolve({ en: null, fi: null, ne: null }),
          data.subtitle !== undefined
            ? translateToAllLocales(data.subtitle)
            : Promise.resolve({ en: null, fi: null, ne: null }),
          data.ctaLabel !== undefined
            ? translateToAllLocales(data.ctaLabel)
            : Promise.resolve({ en: null, fi: null, ne: null }),
        ]);

      // Get existing translations to preserve values that aren't being updated
      const existingTranslations = await db
        .select()
        .from(homepageHeroTranslations)
        .where(eq(homepageHeroTranslations.heroId, data.id));

      const existingByLocale = new Map(
        existingTranslations.map((t) => [t.locale, t])
      );

      // Update or insert for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        const existing = existingByLocale.get(loc);
        const translationData: {
          heroId: string;
          locale: string;
          title?: string | null;
          subtitle?: string | null;
          ctaLabel?: string | null;
        } = {
          heroId: data.id,
          locale: loc,
        };

        // Use new translations if provided, otherwise keep existing values
        if (data.title !== undefined) {
          translationData.title = (
            titleTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.title = existing.title;
        }

        if (data.subtitle !== undefined) {
          translationData.subtitle = (
            subtitleTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.subtitle = existing.subtitle;
        }

        if (data.ctaLabel !== undefined) {
          translationData.ctaLabel = (
            ctaLabelTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.ctaLabel = existing.ctaLabel;
        }

        if (existing) {
          await db
            .update(homepageHeroTranslations)
            .set(translationData)
            .where(eq(homepageHeroTranslations.id, existing.id));
        } else {
          await db.insert(homepageHeroTranslations).values(translationData);
        }
      }
    }

    const message =
      data.order !== undefined && updateData.order !== data.order
        ? `Hero slide updated successfully (order adjusted to ${updateData.order} as ${data.order} was already taken)`
        : "Hero slide updated successfully";

    return {
      success: true,
      message,
      result: updatedSlide[0],
    };
  } catch (error) {
    console.error("Error updating hero slide:", error);

    // Handle specific database errors
    if (
      error instanceof Error &&
      error.message.includes("duplicate key value violates unique constraint")
    ) {
      return {
        success: false,
        error:
          "A hero slide with this order number already exists. Please try a different order number.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update hero slide",
    };
  }
}

export async function deleteHeroSlide(id: string): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Get the slide to get the image URL for Cloudinary deletion
    const slide = await db
      .select()
      .from(homepageHero)
      .where(eq(homepageHero.id, id))
      .limit(1);

    if (slide.length === 0) {
      return {
        success: false,
        error: "Hero slide not found",
      };
    }

    // Delete from database
    await db.delete(homepageHero).where(eq(homepageHero.id, id));

    // Delete image from Cloudinary
    if (slide[0].imageUrl) {
      try {
        await deleteFile(slide[0].imageUrl, "homepage-hero");
      } catch (cloudinaryError) {
        console.error("Error deleting image from Cloudinary:", cloudinaryError);
        // Don't fail the operation if Cloudinary deletion fails
      }
    }

    return {
      success: true,
      message: "Hero slide deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting hero slide:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete hero slide",
    };
  }
}

// About Section Actions
export interface AboutSection {
  id: string;
  title: string | null;
  content: string | null;
  assetUrl: string | null;
  isActive: boolean;
}

export interface CreateAboutData {
  title?: string;
  content?: string;
  assetUrl?: string;
  assetFile?: File;
  isActive?: boolean;
}

export interface UpdateAboutData extends Partial<CreateAboutData> {
  id: string;
}

export async function getAboutSection(): Promise<
  ActionResponse & { result?: AboutSection | null }
> {
  try {
    await getCurrentAdmin();

    // Fetch about section with English translations (admin dashboard uses English)
    const about = await db
      .select({
        id: homepageAbout.id,
        assetUrl: homepageAbout.assetUrl,
        isActive: homepageAbout.isActive,
        title: homepageAboutTranslations.title,
        content: homepageAboutTranslations.content,
      })
      .from(homepageAbout)
      .leftJoin(
        homepageAboutTranslations,
        and(
          eq(homepageAboutTranslations.aboutId, homepageAbout.id),
          eq(homepageAboutTranslations.locale, "en")
        )
      )
      .where(eq(homepageAbout.isActive, true))
      .limit(1);

    if (about.length === 0) {
      return {
        success: true,
        result: null,
      };
    }

    return {
      success: true,
      result: {
        id: about[0].id,
        title: about[0].title ?? null,
        content: about[0].content ?? null,
        assetUrl: about[0].assetUrl ?? null,
        isActive: about[0].isActive ?? true,
      } as AboutSection,
    };
  } catch (error) {
    console.error("Error fetching about section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch about section",
    };
  }
}

// Public version for homepage (no authentication required)
export async function getPublicAboutSection(
  locale: string = "en"
): Promise<ActionResponse & { result?: AboutSection | null }> {
  try {
    // If locale is English, just fetch English translations
    if (locale === "en") {
      const about = await db
        .select({
          id: homepageAbout.id,
          assetUrl: homepageAbout.assetUrl,
          isActive: homepageAbout.isActive,
          title: homepageAboutTranslations.title,
          content: homepageAboutTranslations.content,
        })
        .from(homepageAbout)
        .leftJoin(
          homepageAboutTranslations,
          and(
            eq(homepageAboutTranslations.aboutId, homepageAbout.id),
            eq(homepageAboutTranslations.locale, "en")
          )
        )
        .where(eq(homepageAbout.isActive, true))
        .limit(1);

      if (about.length === 0) {
        return {
          success: true,
          result: null,
        };
      }

      return {
        success: true,
        result: {
          id: about[0].id,
          title: about[0].title ?? null,
          content: about[0].content ?? null,
          assetUrl: about[0].assetUrl ?? null,
          isActive: about[0].isActive ?? true,
        } as AboutSection,
      };
    }

    // For non-English locales, fetch both current locale and English (for fallback)
    const aboutWithCurrentLocale = await db
      .select({
        id: homepageAbout.id,
        assetUrl: homepageAbout.assetUrl,
        isActive: homepageAbout.isActive,
        title: homepageAboutTranslations.title,
        content: homepageAboutTranslations.content,
      })
      .from(homepageAbout)
      .leftJoin(
        homepageAboutTranslations,
        and(
          eq(homepageAboutTranslations.aboutId, homepageAbout.id),
          eq(homepageAboutTranslations.locale, locale)
        )
      )
      .where(eq(homepageAbout.isActive, true))
      .limit(1);

    if (aboutWithCurrentLocale.length === 0) {
      return {
        success: true,
        result: null,
      };
    }

    // Fetch English translations for fallback
    const aboutId = aboutWithCurrentLocale[0].id;
    const englishTranslations = await db
      .select({
        title: homepageAboutTranslations.title,
        content: homepageAboutTranslations.content,
      })
      .from(homepageAboutTranslations)
      .where(
        and(
          eq(homepageAboutTranslations.aboutId, aboutId),
          eq(homepageAboutTranslations.locale, "en")
        )
      )
      .limit(1);

    const enTrans = englishTranslations[0];

    return {
      success: true,
      result: {
        id: aboutWithCurrentLocale[0].id,
        title: aboutWithCurrentLocale[0].title ?? enTrans?.title ?? null,
        content: aboutWithCurrentLocale[0].content ?? enTrans?.content ?? null,
        assetUrl: aboutWithCurrentLocale[0].assetUrl ?? null,
        isActive: aboutWithCurrentLocale[0].isActive ?? true,
      } as AboutSection,
    };
  } catch (error) {
    console.error("Error fetching public about section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch about section",
    };
  }
}

export async function createAboutSection(
  data: CreateAboutData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    let assetUrl = data.assetUrl;

    // Upload asset if file is provided
    if (data.assetFile) {
      assetUrl = await uploadFile(data.assetFile, "homepage/about");
    }

    // Deactivate existing about sections
    await db
      .update(homepageAbout)
      .set({ isActive: false })
      .where(eq(homepageAbout.isActive, true));

    // Insert base about section (non-translatable fields only)
    const newAbout = await db
      .insert(homepageAbout)
      .values({
        assetUrl: assetUrl || null,
        isActive: data.isActive ?? true,
      })
      .returning();

    // Translate and insert translations for all locales
    if (data.title || data.content) {
      const [titleTranslations, contentTranslations] = await Promise.all([
        translateToAllLocales(data.title),
        translateToAllLocales(data.content),
      ]);

      // Insert translations for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        await db.insert(homepageAboutTranslations).values({
          aboutId: newAbout[0].id,
          locale: loc,
          title: titleTranslations[loc],
          content: contentTranslations[loc],
        });
      }
    }

    return {
      success: true,
      message: "About section created successfully",
      result: newAbout[0],
    };
  } catch (error) {
    console.error("Error creating about section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create about section",
    };
  }
}

export async function updateAboutSection(
  data: UpdateAboutData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    const updateData: Partial<typeof homepageAbout.$inferInsert> = {};

    // Handle asset upload if file is provided
    if (data.assetFile) {
      updateData.assetUrl = await uploadFile(data.assetFile, "homepage/about");
    } else if (data.assetUrl !== undefined) {
      updateData.assetUrl = data.assetUrl;
    }

    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Update base table
    const updatedAbout = await db
      .update(homepageAbout)
      .set(updateData)
      .where(eq(homepageAbout.id, data.id))
      .returning();

    if (updatedAbout.length === 0) {
      return {
        success: false,
        error: "About section not found",
      };
    }

    // Translate and update/insert translations for all locales
    if (data.title !== undefined || data.content !== undefined) {
      const [titleTranslations, contentTranslations] = await Promise.all([
        data.title !== undefined
          ? translateToAllLocales(data.title)
          : Promise.resolve({ en: null, fi: null, ne: null }),
        data.content !== undefined
          ? translateToAllLocales(data.content)
          : Promise.resolve({ en: null, fi: null, ne: null }),
      ]);

      // Get existing translations to preserve values that aren't being updated
      const existingTranslations = await db
        .select()
        .from(homepageAboutTranslations)
        .where(eq(homepageAboutTranslations.aboutId, data.id));

      const existingByLocale = new Map(
        existingTranslations.map((t) => [t.locale, t])
      );

      // Update or insert for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        const existing = existingByLocale.get(loc);
        const translationData: {
          aboutId: string;
          locale: string;
          title?: string | null;
          content?: string | null;
        } = {
          aboutId: data.id,
          locale: loc,
        };

        // Use new translations if provided, otherwise keep existing values
        if (data.title !== undefined) {
          translationData.title = (
            titleTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.title = existing.title;
        }

        if (data.content !== undefined) {
          translationData.content = (
            contentTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.content = existing.content;
        }

        if (existing) {
          await db
            .update(homepageAboutTranslations)
            .set(translationData)
            .where(eq(homepageAboutTranslations.id, existing.id));
        } else {
          await db.insert(homepageAboutTranslations).values(translationData);
        }
      }
    }

    return {
      success: true,
      message: "About section updated successfully",
      result: updatedAbout[0],
    };
  } catch (error) {
    console.error("Error updating about section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update about section",
    };
  }
}

// Benefits Section Actions
export interface BenefitItem {
  icon: string;
  title: string;
  description: string;
}

export interface BenefitsSection {
  id: string;
  title: string | null;
  items: BenefitItem[];
  isActive: boolean;
}

export interface CreateBenefitsData {
  title?: string;
  items?: BenefitItem[];
  isActive?: boolean;
}

export interface UpdateBenefitsData extends Partial<CreateBenefitsData> {
  id: string;
}

export async function getBenefitsSection(): Promise<
  ActionResponse & { result?: BenefitsSection | null }
> {
  try {
    await getCurrentAdmin();

    // Fetch benefits section with English translations (admin dashboard uses English)
    const benefits = await db
      .select({
        id: homepageBenefits.id,
        isActive: homepageBenefits.isActive,
        title: homepageBenefitTranslations.title,
        items: homepageBenefitTranslations.items,
      })
      .from(homepageBenefits)
      .leftJoin(
        homepageBenefitTranslations,
        and(
          eq(homepageBenefitTranslations.benefitId, homepageBenefits.id),
          eq(homepageBenefitTranslations.locale, "en")
        )
      )
      .where(eq(homepageBenefits.isActive, true))
      .limit(1);

    if (benefits.length === 0) {
      return {
        success: true,
        result: null,
      };
    }

    return {
      success: true,
      result: {
        id: benefits[0].id,
        title: benefits[0].title ?? null,
        items: (benefits[0].items as BenefitItem[]) || [],
        isActive: benefits[0].isActive ?? true,
      } as BenefitsSection,
    };
  } catch (error) {
    console.error("Error fetching benefits section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch benefits section",
    };
  }
}

// Public version for homepage (no authentication required)
export async function getPublicBenefitsSection(
  locale: string = "en"
): Promise<ActionResponse & { result?: BenefitsSection | null }> {
  try {
    // If locale is English, just fetch English translations
    if (locale === "en") {
      const benefits = await db
        .select({
          id: homepageBenefits.id,
          isActive: homepageBenefits.isActive,
          title: homepageBenefitTranslations.title,
          items: homepageBenefitTranslations.items,
        })
        .from(homepageBenefits)
        .leftJoin(
          homepageBenefitTranslations,
          and(
            eq(homepageBenefitTranslations.benefitId, homepageBenefits.id),
            eq(homepageBenefitTranslations.locale, "en")
          )
        )
        .where(eq(homepageBenefits.isActive, true))
        .limit(1);

      if (benefits.length === 0) {
        return {
          success: true,
          result: null,
        };
      }

      return {
        success: true,
        result: {
          id: benefits[0].id,
          title: benefits[0].title ?? null,
          items: (benefits[0].items as BenefitItem[]) || [],
          isActive: benefits[0].isActive ?? true,
        } as BenefitsSection,
      };
    }

    // For non-English locales, fetch both current locale and English (for fallback)
    const benefitsWithCurrentLocale = await db
      .select({
        id: homepageBenefits.id,
        isActive: homepageBenefits.isActive,
        title: homepageBenefitTranslations.title,
        items: homepageBenefitTranslations.items,
      })
      .from(homepageBenefits)
      .leftJoin(
        homepageBenefitTranslations,
        and(
          eq(homepageBenefitTranslations.benefitId, homepageBenefits.id),
          eq(homepageBenefitTranslations.locale, locale)
        )
      )
      .where(eq(homepageBenefits.isActive, true))
      .limit(1);

    if (benefitsWithCurrentLocale.length === 0) {
      return {
        success: true,
        result: null,
      };
    }

    // Fetch English translations for fallback
    const benefitId = benefitsWithCurrentLocale[0].id;
    const englishTranslations = await db
      .select({
        title: homepageBenefitTranslations.title,
        items: homepageBenefitTranslations.items,
      })
      .from(homepageBenefitTranslations)
      .where(
        and(
          eq(homepageBenefitTranslations.benefitId, benefitId),
          eq(homepageBenefitTranslations.locale, "en")
        )
      )
      .limit(1);

    const enTrans = englishTranslations[0];

    return {
      success: true,
      result: {
        id: benefitsWithCurrentLocale[0].id,
        title: benefitsWithCurrentLocale[0].title ?? enTrans?.title ?? null,
        items:
          (benefitsWithCurrentLocale[0].items as BenefitItem[]) ||
          (enTrans?.items as BenefitItem[]) ||
          [],
        isActive: benefitsWithCurrentLocale[0].isActive ?? true,
      } as BenefitsSection,
    };
  } catch (error) {
    console.error("Error fetching public benefits section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch benefits section",
    };
  }
}

export async function createBenefitsSection(
  data: CreateBenefitsData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Deactivate existing benefits sections
    await db
      .update(homepageBenefits)
      .set({ isActive: false })
      .where(eq(homepageBenefits.isActive, true));

    // Insert base benefits section (non-translatable fields only)
    const newBenefits = await db
      .insert(homepageBenefits)
      .values({
        isActive: data.isActive ?? true,
      })
      .returning();

    // Translate and insert translations for all locales
    if (data.title || data.items) {
      const [titleTranslations, itemsTranslations] = await Promise.all([
        translateToAllLocales(data.title),
        translateBenefitItems(data.items),
      ]);

      // Insert translations for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        await db.insert(homepageBenefitTranslations).values({
          benefitId: newBenefits[0].id,
          locale: loc,
          title: titleTranslations[loc],
          items: itemsTranslations[loc],
        });
      }
    }

    return {
      success: true,
      message: "Benefits section created successfully",
      result: newBenefits[0],
    };
  } catch (error) {
    console.error("Error creating benefits section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create benefits section",
    };
  }
}

export async function updateBenefitsSection(
  data: UpdateBenefitsData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    const updateData: Partial<typeof homepageBenefits.$inferInsert> = {};
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Update base table
    const updatedBenefits = await db
      .update(homepageBenefits)
      .set(updateData)
      .where(eq(homepageBenefits.id, data.id))
      .returning();

    if (updatedBenefits.length === 0) {
      return {
        success: false,
        error: "Benefits section not found",
      };
    }

    // Translate and update/insert translations for all locales
    if (data.title !== undefined || data.items !== undefined) {
      const [titleTranslations, itemsTranslations] = await Promise.all([
        data.title !== undefined
          ? translateToAllLocales(data.title)
          : Promise.resolve({ en: null, fi: null, ne: null }),
        data.items !== undefined
          ? translateBenefitItems(data.items)
          : Promise.resolve({ en: null, fi: null, ne: null }),
      ]);

      // Get existing translations to preserve values that aren't being updated
      const existingTranslations = await db
        .select()
        .from(homepageBenefitTranslations)
        .where(eq(homepageBenefitTranslations.benefitId, data.id));

      const existingByLocale = new Map(
        existingTranslations.map((t) => [t.locale, t])
      );

      // Update or insert for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        const existing = existingByLocale.get(loc);
        const translationData: {
          benefitId: string;
          locale: string;
          title?: string | null;
          items?: BenefitItem[] | null;
        } = {
          benefitId: data.id,
          locale: loc,
        };

        // Use new translations if provided, otherwise keep existing values
        if (data.title !== undefined) {
          translationData.title = (
            titleTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.title = existing.title;
        }

        if (data.items !== undefined) {
          translationData.items = (
            itemsTranslations as Record<
              string,
              Array<{ icon: string; title: string; description: string }> | null
            >
          )[loc];
        } else if (existing) {
          translationData.items = existing.items as BenefitItem[] | null;
        }

        if (existing) {
          await db
            .update(homepageBenefitTranslations)
            .set(translationData)
            .where(eq(homepageBenefitTranslations.id, existing.id));
        } else {
          await db.insert(homepageBenefitTranslations).values(translationData);
        }
      }
    }

    return {
      success: true,
      message: "Benefits section updated successfully",
      result: updatedBenefits[0],
    };
  } catch (error) {
    console.error("Error updating benefits section:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update benefits section",
    };
  }
}
