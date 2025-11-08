"use server";

import { db } from "@/db";
import {
  navbar as navbarTable,
  navbarItems,
  navbarTranslations,
  navbarItemTranslations,
  footerSections,
  footerItems,
  footerSectionTranslations,
  footerItemTranslations,
  aboutPage,
  aboutSections,
  aboutPageTranslations,
  aboutSectionTranslations,
  type AboutPage as AboutPageRow,
} from "@/db/schema";
import { asc, eq, and, inArray } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { uploadFileWithResult, deleteFile } from "@/lib/cloudinary";
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

// Helper function to translate extraData object (for about sections)
async function translateExtraData(
  extraData: Record<string, string> | null | undefined
): Promise<Record<string, Record<string, string> | null>> {
  if (!extraData) {
    return { en: null, fi: null, ne: null };
  }

  const translations: Record<string, Record<string, string> | null> = {
    en: extraData, // English is the source
  };

  try {
    const fiExtraData: Record<string, string> = {};
    for (const [key, value] of Object.entries(extraData)) {
      if (typeof value === "string") {
        fiExtraData[key] = await translateText(value, "fi");
      } else {
        fiExtraData[key] = value;
      }
    }
    translations.fi = fiExtraData;
  } catch (error) {
    console.error("Error translating extraData to Finnish:", error);
    translations.fi = extraData; // Fallback to English
  }

  try {
    const neExtraData: Record<string, string> = {};
    for (const [key, value] of Object.entries(extraData)) {
      if (typeof value === "string") {
        neExtraData[key] = await translateText(value, "ne");
      } else {
        neExtraData[key] = value;
      }
    }
    translations.ne = neExtraData;
  } catch (error) {
    console.error("Error translating extraData to Nepali:", error);
    translations.ne = extraData; // Fallback to English
  }

  return translations;
}

export type NavbarData = {
  title: string;
  logoUrl: string;
  items: Array<{
    id: number;
    label: string;
    href: string;
    order: number | null;
    requiresAuth: boolean | null;
    isVisible: boolean | null;
  }>;
};

export const getNavbarData = unstable_cache(
  async (locale: string = "en"): Promise<NavbarData | null> => {
    const nav = await db.select().from(navbarTable).limit(1);
    if (nav.length === 0) return null;
    const [bar] = nav;

    // Get navbar translation (current locale and English for fallback)
    const [navTranslations, navTranslationsEn] = await Promise.all([
      db
        .select()
        .from(navbarTranslations)
        .where(
          and(
            eq(navbarTranslations.navbarId, bar.id),
            eq(navbarTranslations.locale, locale)
          )
        )
        .limit(1),
      locale !== "en"
        ? db
            .select()
            .from(navbarTranslations)
            .where(
              and(
                eq(navbarTranslations.navbarId, bar.id),
                eq(navbarTranslations.locale, "en")
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);
    const navTitle =
      navTranslations[0]?.title || navTranslationsEn[0]?.title || "Golden Hive";

    // Get items with translations (current locale and English for fallback)
    const itemsWithCurrentLocale = await db
      .select({
        id: navbarItems.id,
        href: navbarItems.href,
        order: navbarItems.order,
        requiresAuth: navbarItems.requiresAuth,
        isVisible: navbarItems.isVisible,
        label: navbarItemTranslations.label,
      })
      .from(navbarItems)
      .leftJoin(
        navbarItemTranslations,
        and(
          eq(navbarItemTranslations.itemId, navbarItems.id),
          eq(navbarItemTranslations.locale, locale)
        )
      )
      .where(eq(navbarItems.navbarId, bar.id))
      .orderBy(asc(navbarItems.order));

    // Fetch English translations for fallback if not English locale
    let itemsEnMap = new Map<number, string>();
    if (locale !== "en") {
      const itemIds = itemsWithCurrentLocale.map((i) => i.id);
      if (itemIds.length > 0) {
        const itemsEn = await db
          .select({
            itemId: navbarItemTranslations.itemId,
            label: navbarItemTranslations.label,
          })
          .from(navbarItemTranslations)
          .where(
            and(
              eq(navbarItemTranslations.locale, "en"),
              inArray(navbarItemTranslations.itemId, itemIds)
            )
          );
        itemsEnMap = new Map(itemsEn.map((i) => [i.itemId, i.label || ""]));
      }
    }

    return {
      title: navTitle,
      logoUrl: bar.logoUrl,
      items: itemsWithCurrentLocale.map((i) => ({
        id: i.id,
        label: i.label || itemsEnMap.get(i.id) || "",
        href: i.href,
        order: i.order,
        requiresAuth: i.requiresAuth,
        isVisible: i.isVisible,
      })),
    };
  },
  ["navbar"],
  { tags: ["navbar"] }
);

export type FooterData = Array<{
  id: number;
  title: string;
  order: number | null;
  items: Array<{
    id: number;
    text: string | null;
    href: string | null;
    icon: string | null;
    hasIcon: boolean | null;
    listItems: string[] | null;
    order: number | null;
  }>;
}>;

export const getFooterData = unstable_cache(
  async (locale: string = "en"): Promise<FooterData> => {
    const sections = await db
      .select()
      .from(footerSections)
      .orderBy(asc(footerSections.order));

    const results: FooterData = [];
    for (const s of sections) {
      // Get section translation (current locale and English for fallback)
      const [sectionTranslations, sectionTranslationsEn] = await Promise.all([
        db
          .select()
          .from(footerSectionTranslations)
          .where(
            and(
              eq(footerSectionTranslations.sectionId, s.id),
              eq(footerSectionTranslations.locale, locale)
            )
          )
          .limit(1),
        locale !== "en"
          ? db
              .select()
              .from(footerSectionTranslations)
              .where(
                and(
                  eq(footerSectionTranslations.sectionId, s.id),
                  eq(footerSectionTranslations.locale, "en")
                )
              )
              .limit(1)
          : Promise.resolve([]),
      ]);
      const sectionTitle =
        sectionTranslations[0]?.title || sectionTranslationsEn[0]?.title || "";

      // Get items with translations (current locale)
      const itemsWithCurrentLocale = await db
        .select({
          id: footerItems.id,
          href: footerItems.href,
          icon: footerItems.icon,
          hasIcon: footerItems.hasIcon,
          listItems: footerItems.listItems,
          order: footerItems.order,
          text: footerItemTranslations.text,
        })
        .from(footerItems)
        .leftJoin(
          footerItemTranslations,
          and(
            eq(footerItemTranslations.itemId, footerItems.id),
            eq(footerItemTranslations.locale, locale)
          )
        )
        .where(eq(footerItems.sectionId, s.id))
        .orderBy(asc(footerItems.order));

      // Fetch English translations for fallback if not English locale
      let itemsEnMap = new Map<number, string | null>();
      if (locale !== "en") {
        const itemIds = itemsWithCurrentLocale.map((i) => i.id);
        if (itemIds.length > 0) {
          const itemsEn = await db
            .select({
              itemId: footerItemTranslations.itemId,
              text: footerItemTranslations.text,
            })
            .from(footerItemTranslations)
            .where(
              and(
                eq(footerItemTranslations.locale, "en"),
                inArray(footerItemTranslations.itemId, itemIds)
              )
            );
          itemsEnMap = new Map(itemsEn.map((i) => [i.itemId, i.text ?? null]));
        }
      }

      results.push({
        id: s.id,
        title: sectionTitle,
        order: s.order,
        items: itemsWithCurrentLocale.map((i) => ({
          id: i.id,
          text: i.text ?? itemsEnMap.get(i.id) ?? null,
          href: i.href ?? null,
          icon: i.icon ?? null,
          hasIcon: i.hasIcon ?? null,
          listItems: (i.listItems as unknown as string[] | null) ?? null,
          order: i.order,
        })),
      });
    }
    return results;
  },
  ["footer"],
  { tags: ["footer"] }
);

export type AboutData = {
  title: string;
  description: string | null;
  metadata: { openGraphTitle?: string; openGraphDescription?: string } | null;
  sections: Array<{
    id: number;
    type: string;
    title: string | null;
    subtitle: string | null;
    content: string | null;
    imageUrl: string | null;
    extraData: unknown;
    order: number | null;
    isVisible: boolean | null;
  }>;
} | null;

type AboutMetadata = AboutPageRow["metadata"];
// extraData is now in the translation table, define the type directly
type AboutExtraData = {
  card1Icon?: string;
  card1Title?: string;
  card1Text?: string;
  card2Icon?: string;
  card2Title?: string;
  card2Text?: string;
  card3Icon?: string;
  card3Title?: string;
  card3Text?: string;
};

export const getAboutData = unstable_cache(
  async (locale: string = "en"): Promise<AboutData> => {
    const page = await db.select().from(aboutPage).limit(1);
    if (page.length === 0) return null;
    const [p] = page;

    // Get page translation (current locale and English for fallback)
    const [pageTranslations, pageTranslationsEn] = await Promise.all([
      db
        .select()
        .from(aboutPageTranslations)
        .where(
          and(
            eq(aboutPageTranslations.aboutId, p.id),
            eq(aboutPageTranslations.locale, locale)
          )
        )
        .limit(1),
      locale !== "en"
        ? db
            .select()
            .from(aboutPageTranslations)
            .where(
              and(
                eq(aboutPageTranslations.aboutId, p.id),
                eq(aboutPageTranslations.locale, "en")
              )
            )
            .limit(1)
        : Promise.resolve([]),
    ]);
    const pageTitle =
      pageTranslations[0]?.title || pageTranslationsEn[0]?.title || null;
    const pageDescription =
      pageTranslations[0]?.description ??
      pageTranslationsEn[0]?.description ??
      null;

    // Get sections with translations (current locale)
    const sectionsWithCurrentLocale = await db
      .select({
        id: aboutSections.id,
        type: aboutSections.type,
        imageUrl: aboutSections.imageUrl,
        order: aboutSections.order,
        isVisible: aboutSections.isVisible,
        title: aboutSectionTranslations.title,
        subtitle: aboutSectionTranslations.subtitle,
        content: aboutSectionTranslations.content,
        extraData: aboutSectionTranslations.extraData,
      })
      .from(aboutSections)
      .leftJoin(
        aboutSectionTranslations,
        and(
          eq(aboutSectionTranslations.sectionId, aboutSections.id),
          eq(aboutSectionTranslations.locale, locale)
        )
      )
      .where(eq(aboutSections.aboutId, p.id))
      .orderBy(asc(aboutSections.order));

    // Fetch English translations for fallback if not English locale
    let sectionsEnMap = new Map<
      number,
      {
        title: string | null;
        subtitle: string | null;
        content: string | null;
        extraData: AboutExtraData | null;
      }
    >();
    if (locale !== "en") {
      const sectionIds = sectionsWithCurrentLocale.map((s) => s.id);
      if (sectionIds.length > 0) {
        const sectionsEn = await db
          .select({
            sectionId: aboutSectionTranslations.sectionId,
            title: aboutSectionTranslations.title,
            subtitle: aboutSectionTranslations.subtitle,
            content: aboutSectionTranslations.content,
            extraData: aboutSectionTranslations.extraData,
          })
          .from(aboutSectionTranslations)
          .where(
            and(
              eq(aboutSectionTranslations.locale, "en"),
              inArray(aboutSectionTranslations.sectionId, sectionIds)
            )
          );
        sectionsEnMap = new Map(
          sectionsEn.map((s) => [
            s.sectionId,
            {
              title: s.title ?? null,
              subtitle: s.subtitle ?? null,
              content: s.content ?? null,
              extraData: (s.extraData as AboutExtraData | null) ?? null,
            },
          ])
        );
      }
    }

    return {
      title: pageTitle || "",
      description: pageDescription,
      metadata: (p.metadata as AboutMetadata) ?? null,
      sections: sectionsWithCurrentLocale.map((s) => {
        const enTrans = sectionsEnMap.get(s.id);
        return {
          id: s.id,
          type: s.type,
          title: s.title ?? enTrans?.title ?? null,
          subtitle: s.subtitle ?? enTrans?.subtitle ?? null,
          content: s.content ?? enTrans?.content ?? null,
          imageUrl: s.imageUrl ?? null,
          extraData:
            (s.extraData as AboutExtraData | null) ??
            enTrans?.extraData ??
            null,
          order: s.order,
          isVisible: s.isVisible,
        };
      }),
    };
  },
  ["about"],
  { tags: ["about"] }
);

export async function revalidateNavbar() {
  revalidateTag("navbar");
}

export async function revalidateFooter() {
  revalidateTag("footer");
}

export async function revalidateAbout() {
  revalidateTag("about");
}

// ========================
// Admin CRUD Actions
// ========================

// NAVBAR
export async function updateNavbar(data: { title?: string; logoUrl?: string }) {
  const existing = await db.select().from(navbarTable).limit(1);
  let navId: number;

  if (existing.length === 0) {
    const newNav = await db
      .insert(navbarTable)
      .values({
        logoUrl: data.logoUrl ?? "/next.svg",
      })
      .returning();
    navId = newNav[0].id;
  } else {
    navId = existing[0].id;
    if (data.logoUrl !== undefined) {
      await db
        .update(navbarTable)
        .set({ logoUrl: data.logoUrl })
        .where(eq(navbarTable.id, navId));
    }
  }

  // Translate and update/insert translations for all locales
  if (data.title !== undefined) {
    const titleTranslations = await translateToAllLocales(data.title);

    // Get existing translations
    const existingTranslations = await db
      .select()
      .from(navbarTranslations)
      .where(eq(navbarTranslations.navbarId, navId));

    const existingByLocale = new Map(
      existingTranslations.map((t) => [t.locale, t])
    );

    // Update or insert for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      const existing = existingByLocale.get(loc);
      if (existing) {
        await db
          .update(navbarTranslations)
          .set({ title: titleTranslations[loc] || data.title || "" })
          .where(eq(navbarTranslations.id, existing.id));
      } else {
        await db.insert(navbarTranslations).values({
          navbarId: navId,
          locale: loc,
          title: titleTranslations[loc] || data.title || "",
        });
      }
    }
  }

  revalidateTag("navbar");
  return { success: true } as const;
}

export async function createNavbarItem(data: {
  label: string;
  href: string;
  order?: number | null;
  requiresAuth?: boolean | null;
  isVisible?: boolean | null;
}) {
  const existing = await db.select().from(navbarTable).limit(1);
  const navId = existing.length
    ? existing[0].id
    : (
        await db
          .insert(navbarTable)
          .values({ logoUrl: "/next.svg" })
          .returning()
      )[0].id;

  // Insert base item (non-translatable fields only)
  const newItem = await db
    .insert(navbarItems)
    .values({
      navbarId: navId,
      href: data.href,
      order: data.order ?? 0,
      // Treat null as "no auth requirement" so items aren't hidden when logged in
      requiresAuth: data.requiresAuth ?? null,
      isVisible: data.isVisible ?? true,
    })
    .returning();

  // Translate and insert translations for all locales
  const labelTranslations = await translateToAllLocales(data.label);
  const locales = ["en", "fi", "ne"];
  for (const loc of locales) {
    await db.insert(navbarItemTranslations).values({
      itemId: newItem[0].id,
      locale: loc,
      label: labelTranslations[loc] || data.label, // Fallback to original if translation fails
    });
  }

  revalidateTag("navbar");
  return { success: true } as const;
}

export async function updateNavbarItem(
  id: number,
  data: Partial<{
    label: string;
    href: string;
    order: number | null;
    requiresAuth: boolean | null;
    isVisible: boolean | null;
  }>
) {
  // Update base item (non-translatable fields)
  const baseData: Partial<typeof navbarItems.$inferInsert> = {};
  if (data.href !== undefined) baseData.href = data.href;
  if (data.order !== undefined) baseData.order = data.order;
  if (data.requiresAuth !== undefined)
    baseData.requiresAuth = data.requiresAuth;
  if (data.isVisible !== undefined) baseData.isVisible = data.isVisible;

  if (Object.keys(baseData).length > 0) {
    await db.update(navbarItems).set(baseData).where(eq(navbarItems.id, id));
  }

  // Translate and update/insert translations for all locales
  if (data.label !== undefined) {
    const labelTranslations = await translateToAllLocales(data.label);

    // Get existing translations
    const existingTranslations = await db
      .select()
      .from(navbarItemTranslations)
      .where(eq(navbarItemTranslations.itemId, id));

    const existingByLocale = new Map(
      existingTranslations.map((t) => [t.locale, t])
    );

    // Update or insert for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      const existing = existingByLocale.get(loc);
      if (existing) {
        await db
          .update(navbarItemTranslations)
          .set({ label: labelTranslations[loc] || data.label })
          .where(eq(navbarItemTranslations.id, existing.id));
      } else {
        await db.insert(navbarItemTranslations).values({
          itemId: id,
          locale: loc,
          label: labelTranslations[loc] || data.label,
        });
      }
    }
  }

  revalidateTag("navbar");
  return { success: true } as const;
}

export async function deleteNavbarItem(id: number) {
  await db.delete(navbarItems).where(eq(navbarItems.id, id));
  revalidateTag("navbar");
  return { success: true } as const;
}

// FOOTER
export async function upsertFooterSection(data: {
  id?: number;
  title: string;
  order?: number | null;
}) {
  let sectionId: number;

  if (data.id) {
    sectionId = data.id;
    if (data.order !== undefined) {
      await db
        .update(footerSections)
        .set({ order: data.order ?? null })
        .where(eq(footerSections.id, sectionId));
    }
  } else {
    const newSection = await db
      .insert(footerSections)
      .values({ order: data.order ?? 0 })
      .returning();
    sectionId = newSection[0].id;
  }

  // Translate and update/insert translations for all locales
  const titleTranslations = await translateToAllLocales(data.title);

  // Get existing translations
  const existingTranslations = await db
    .select()
    .from(footerSectionTranslations)
    .where(eq(footerSectionTranslations.sectionId, sectionId));

  const existingByLocale = new Map(
    existingTranslations.map((t) => [t.locale, t])
  );

  // Update or insert for all locales
  const locales = ["en", "fi", "ne"];
  for (const loc of locales) {
    const existing = existingByLocale.get(loc);
    if (existing) {
      await db
        .update(footerSectionTranslations)
        .set({ title: titleTranslations[loc] || data.title })
        .where(eq(footerSectionTranslations.id, existing.id));
    } else {
      await db.insert(footerSectionTranslations).values({
        sectionId,
        locale: loc,
        title: titleTranslations[loc] || data.title,
      });
    }
  }

  revalidateTag("footer");
  return { success: true } as const;
}

export async function deleteFooterSection(sectionId: number) {
  await db.delete(footerSections).where(eq(footerSections.id, sectionId));
  revalidateTag("footer");
  return { success: true } as const;
}

export async function upsertFooterItem(data: {
  id?: number;
  sectionId: number;
  text?: string | null;
  href?: string | null;
  icon?: string | null;
  hasIcon?: boolean | null;
  listItems?: string[] | null;
  order?: number | null;
}) {
  const basePayload: {
    sectionId: number;
    href: string | null;
    icon: string | null;
    hasIcon: boolean | null;
    listItems: string[] | null;
    order: number;
  } = {
    sectionId: data.sectionId,
    href: data.href ?? null,
    icon: data.icon ?? null,
    hasIcon: data.hasIcon ?? null,
    listItems: data.listItems ?? null,
    order: data.order ?? 0,
  };

  let itemId: number;
  if (data.id) {
    itemId = data.id;
    await db
      .update(footerItems)
      .set(basePayload)
      .where(eq(footerItems.id, itemId));
  } else {
    const newItem = await db
      .insert(footerItems)
      .values(basePayload)
      .returning();
    itemId = newItem[0].id;
  }

  // Translate and update/insert translations for all locales
  if (data.text !== undefined) {
    const textTranslations = await translateToAllLocales(data.text);

    // Get existing translations
    const existingTranslations = await db
      .select()
      .from(footerItemTranslations)
      .where(eq(footerItemTranslations.itemId, itemId));

    const existingByLocale = new Map(
      existingTranslations.map((t) => [t.locale, t])
    );

    // Update or insert for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      const existing = existingByLocale.get(loc);
      if (existing) {
        await db
          .update(footerItemTranslations)
          .set({ text: textTranslations[loc] || data.text })
          .where(eq(footerItemTranslations.id, existing.id));
      } else {
        await db.insert(footerItemTranslations).values({
          itemId,
          locale: loc,
          text: textTranslations[loc] || data.text,
        });
      }
    }
  }

  revalidateTag("footer");
  return { success: true } as const;
}

export async function deleteFooterItem(id: number) {
  await db.delete(footerItems).where(eq(footerItems.id, id));
  revalidateTag("footer");
  return { success: true } as const;
}

// ABOUT
export async function updateAboutPageContent(data: {
  title?: string;
  description?: string | null;
  metadata?: AboutMetadata;
}) {
  const page = await db.select().from(aboutPage).limit(1);
  let pageId: number;

  if (page.length === 0) {
    const newPage = await db
      .insert(aboutPage)
      .values({
        metadata: (data.metadata as AboutMetadata) ?? null,
      })
      .returning();
    pageId = newPage[0].id;
  } else {
    pageId = page[0].id;
    if (data.metadata !== undefined) {
      await db
        .update(aboutPage)
        .set({
          metadata: (data.metadata as AboutMetadata) ?? page[0].metadata,
        })
        .where(eq(aboutPage.id, pageId));
    }
  }

  // Translate and update/insert translations for all locales
  if (data.title !== undefined || data.description !== undefined) {
    const [titleTranslations, descriptionTranslations] = await Promise.all([
      data.title !== undefined
        ? translateToAllLocales(data.title)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            string | null
          >),
      data.description !== undefined
        ? translateToAllLocales(data.description)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            string | null
          >),
    ]);

    // Get existing translations
    const existingTranslations = await db
      .select()
      .from(aboutPageTranslations)
      .where(eq(aboutPageTranslations.aboutId, pageId));

    const existingByLocale = new Map(
      existingTranslations.map((t) => [t.locale, t])
    );

    // Update or insert for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      const existing = existingByLocale.get(loc);
      const translationData: {
        aboutId: number;
        locale: string;
        title?: string | null;
        description?: string | null;
      } = {
        aboutId: pageId,
        locale: loc,
      };

      // Use new translations if provided, otherwise keep existing values
      if (data.title !== undefined) {
        translationData.title = titleTranslations[loc];
      } else if (existing) {
        translationData.title = existing.title;
      }

      if (data.description !== undefined) {
        translationData.description = descriptionTranslations[loc];
      } else if (existing) {
        translationData.description = existing.description;
      }

      if (existing) {
        await db
          .update(aboutPageTranslations)
          .set(translationData)
          .where(eq(aboutPageTranslations.id, existing.id));
      } else {
        await db.insert(aboutPageTranslations).values(translationData);
      }
    }
  }

  revalidateTag("about");
  revalidatePath("/about");
  return { success: true } as const;
}

export async function upsertAboutSectionContent(data: {
  id?: number;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  extraData?: Record<string, string> | null;
  order?: number | null;
  isVisible?: boolean | null;
}) {
  const page = await db.select().from(aboutPage).limit(1);
  const aboutId = page.length
    ? page[0].id
    : (await db.insert(aboutPage).values({}).returning())[0].id;

  // Base payload (non-translatable fields)
  const basePayload = {
    aboutId,
    type: data.type,
    imageUrl: data.imageUrl ?? null,
    order: data.order ?? 0,
    isVisible: data.isVisible ?? true,
  } as const;

  let sectionId: number;
  if (data.id) {
    sectionId = data.id;
    await db
      .update(aboutSections)
      .set(basePayload)
      .where(eq(aboutSections.id, sectionId));
  } else {
    const newSection = await db
      .insert(aboutSections)
      .values(basePayload)
      .returning();
    sectionId = newSection[0].id;
  }

  // Translate and update/insert translations for all locales
  if (
    data.title !== undefined ||
    data.subtitle !== undefined ||
    data.content !== undefined ||
    data.extraData !== undefined
  ) {
    const [
      titleTranslations,
      subtitleTranslations,
      contentTranslations,
      extraDataTranslations,
    ] = await Promise.all([
      data.title !== undefined
        ? translateToAllLocales(data.title)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            string | null
          >),
      data.subtitle !== undefined
        ? translateToAllLocales(data.subtitle)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            string | null
          >),
      data.content !== undefined
        ? translateToAllLocales(data.content)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            string | null
          >),
      data.extraData !== undefined
        ? translateExtraData(data.extraData)
        : Promise.resolve({ en: null, fi: null, ne: null } as Record<
            string,
            Record<string, string> | null
          >),
    ]);

    // Get existing translations
    const existingTranslations = await db
      .select()
      .from(aboutSectionTranslations)
      .where(eq(aboutSectionTranslations.sectionId, sectionId));

    const existingByLocale = new Map(
      existingTranslations.map((t) => [t.locale, t])
    );

    // Update or insert for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      const existing = existingByLocale.get(loc);
      const translationData: {
        sectionId: number;
        locale: string;
        title?: string | null;
        subtitle?: string | null;
        content?: string | null;
        extraData?: Record<string, string> | null;
      } = {
        sectionId,
        locale: loc,
      };

      // Use new translations if provided, otherwise keep existing values
      if (data.title !== undefined) {
        translationData.title = titleTranslations[loc];
      } else if (existing) {
        translationData.title = existing.title;
      }

      if (data.subtitle !== undefined) {
        translationData.subtitle = subtitleTranslations[loc];
      } else if (existing) {
        translationData.subtitle = existing.subtitle;
      }

      if (data.content !== undefined) {
        translationData.content = contentTranslations[loc];
      } else if (existing) {
        translationData.content = existing.content;
      }

      if (data.extraData !== undefined) {
        translationData.extraData = extraDataTranslations[loc];
      } else if (existing) {
        translationData.extraData = existing.extraData as Record<
          string,
          string
        > | null;
      }

      if (existing) {
        await db
          .update(aboutSectionTranslations)
          .set(translationData)
          .where(eq(aboutSectionTranslations.id, existing.id));
      } else {
        await db.insert(aboutSectionTranslations).values(translationData);
      }
    }
  }

  revalidateTag("about");
  revalidatePath("/about");
  return { success: true } as const;
}

export async function deleteAboutSectionContent(id: number) {
  const existing = await db
    .select()
    .from(aboutSections)
    .where(eq(aboutSections.id, id))
    .limit(1);

  if (existing.length > 0 && existing[0].imageUrl) {
    try {
      await deleteFile(existing[0].imageUrl, "about");
    } catch {
      // ignore cloudinary delete failures
    }
  }

  await db.delete(aboutSections).where(eq(aboutSections.id, id));
  revalidateTag("about");
  revalidatePath("/about");
  return { success: true } as const;
}

// ========================
// Media Upload Helpers
// ========================

export async function updateNavbarLogo(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" } as const;

  // Delete old logo if exists
  const existing = await db.select().from(navbarTable).limit(1);
  if (existing.length > 0 && existing[0].logoUrl) {
    try {
      await deleteFile(existing[0].logoUrl, "branding");
    } catch {
      // ignore
    }
  }

  // Upload new logo
  const result = await uploadFileWithResult(file, "branding");

  // Upsert navbar with new logo
  if (existing.length === 0) {
    await db.insert(navbarTable).values({
      logoUrl: result.secure_url,
    });
  } else {
    await db
      .update(navbarTable)
      .set({ logoUrl: result.secure_url })
      .where(eq(navbarTable.id, existing[0].id));
  }

  revalidateTag("navbar");
  return { success: true, url: result.secure_url } as const;
}

export async function uploadAboutSectionImage(formData: FormData) {
  const file = formData.get("file") as File | null;
  const sectionIdRaw = formData.get("sectionId") as string | null;
  if (!file) return { success: false, error: "No file provided" } as const;

  const sectionId = sectionIdRaw ? Number(sectionIdRaw) : null;

  if (sectionId) {
    const existing = await db
      .select()
      .from(aboutSections)
      .where(eq(aboutSections.id, sectionId))
      .limit(1);
    if (existing.length > 0 && existing[0].imageUrl) {
      try {
        await deleteFile(existing[0].imageUrl, "about");
      } catch {
        // ignore
      }
    }
  }

  const result = await uploadFileWithResult(file, "about");

  if (sectionId) {
    await db
      .update(aboutSections)
      .set({ imageUrl: result.secure_url })
      .where(eq(aboutSections.id, sectionId));
  }

  revalidateTag("about");
  revalidatePath("/about");
  return { success: true, url: result.secure_url } as const;
}
