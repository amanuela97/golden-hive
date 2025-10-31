"use server";

import { db } from "@/db";
import {
  navbar as navbarTable,
  navbarItems,
  footerSections,
  footerItems,
  aboutPage,
  aboutSections,
  type AboutPage as AboutPageRow,
  type AboutSections as AboutSectionsRow,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { uploadFileWithResult, deleteFile } from "@/lib/cloudinary";

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
  async (): Promise<NavbarData | null> => {
    const nav = await db.select().from(navbarTable).limit(1);
    if (nav.length === 0) return null;
    const [bar] = nav;
    const items = await db
      .select()
      .from(navbarItems)
      .where(eq(navbarItems.navbarId, bar.id))
      .orderBy(asc(navbarItems.order));

    return {
      title: bar.title,
      logoUrl: bar.logoUrl,
      items: items.map((i) => ({
        id: i.id,
        label: i.label,
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
  async (): Promise<FooterData> => {
    const sections = await db
      .select()
      .from(footerSections)
      .orderBy(asc(footerSections.order));

    const results: FooterData = [];
    for (const s of sections) {
      const items = await db
        .select()
        .from(footerItems)
        .where(eq(footerItems.sectionId, s.id))
        .orderBy(asc(footerItems.order));
      results.push({
        id: s.id,
        title: s.title,
        order: s.order,
        items: items.map((i) => ({
          id: i.id,
          text: i.text ?? null,
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
type AboutExtraData = AboutSectionsRow["extraData"];

export const getAboutData = unstable_cache(
  async (): Promise<AboutData> => {
    const page = await db.select().from(aboutPage).limit(1);
    if (page.length === 0) return null;
    const [p] = page;
    const sections = await db
      .select()
      .from(aboutSections)
      .where(eq(aboutSections.aboutId, p.id))
      .orderBy(asc(aboutSections.order));
    return {
      title: p.title,
      description: p.description ?? null,
      metadata: (p.metadata as AboutMetadata) ?? null,
      sections: sections.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title ?? null,
        subtitle: s.subtitle ?? null,
        content: s.content ?? null,
        imageUrl: s.imageUrl ?? null,
        extraData: (s.extraData as AboutExtraData) ?? null,
        order: s.order,
        isVisible: s.isVisible,
      })),
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
  if (existing.length === 0) {
    await db.insert(navbarTable).values({
      title: data.title ?? "Golden Hive",
      logoUrl: data.logoUrl ?? "/next.svg",
    });
  } else {
    await db
      .update(navbarTable)
      .set({
        title: data.title ?? existing[0].title,
        logoUrl: data.logoUrl ?? existing[0].logoUrl,
      })
      .where(eq(navbarTable.id, existing[0].id));
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
          .values({ title: "Golden Hive", logoUrl: "/next.svg" })
          .returning()
      )[0].id;
  await db.insert(navbarItems).values({
    navbarId: navId,
    label: data.label,
    href: data.href,
    order: data.order ?? 0,
    // Treat null as "no auth requirement" so items aren't hidden when logged in
    requiresAuth: data.requiresAuth ?? null,
    isVisible: data.isVisible ?? true,
  });
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
  await db.update(navbarItems).set(data).where(eq(navbarItems.id, id));
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
  if (data.id) {
    await db
      .update(footerSections)
      .set({ title: data.title, order: data.order ?? null })
      .where(eq(footerSections.id, data.id));
  } else {
    await db
      .insert(footerSections)
      .values({ title: data.title, order: data.order ?? 0 });
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
  const payload: {
    sectionId: number;
    text: string | null;
    href: string | null;
    icon: string | null;
    hasIcon: boolean | null;
    listItems: string[] | null;
    order: number;
  } = {
    sectionId: data.sectionId,
    text: data.text ?? null,
    href: data.href ?? null,
    icon: data.icon ?? null,
    hasIcon: data.hasIcon ?? null,
    listItems: data.listItems ?? null,
    order: data.order ?? 0,
  };
  if (data.id) {
    await db
      .update(footerItems)
      .set(payload)
      .where(eq(footerItems.id, data.id));
  } else {
    await db.insert(footerItems).values(payload);
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
  if (page.length === 0) {
    await db.insert(aboutPage).values({
      title: data.title ?? "About Us",
      description: data.description ?? null,
      metadata: (data.metadata as AboutMetadata) ?? null,
    });
  } else {
    await db
      .update(aboutPage)
      .set({
        title: data.title ?? page[0].title,
        description: data.description ?? page[0].description,
        metadata: (data.metadata as AboutMetadata) ?? page[0].metadata,
      })
      .where(eq(aboutPage.id, page[0].id));
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
    : (await db.insert(aboutPage).values({ title: "About Us" }).returning())[0]
        .id;
  const payload = {
    aboutId,
    type: data.type,
    title: data.title ?? null,
    subtitle: data.subtitle ?? null,
    content: data.content ?? null,
    imageUrl: data.imageUrl ?? null,
    extraData: data.extraData ?? null,
    order: data.order ?? 0,
    isVisible: data.isVisible ?? true,
  } as const;
  if (data.id) {
    await db
      .update(aboutSections)
      .set(payload)
      .where(eq(aboutSections.id, data.id));
  } else {
    await db.insert(aboutSections).values(payload);
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
      title: "Golden Hive",
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
