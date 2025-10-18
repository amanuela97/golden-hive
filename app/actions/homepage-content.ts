"use server";

import { db } from "@/db";
import { homepageHero, homepageAbout, homepageBenefits } from "@/db/schema";
import { eq, asc, ne } from "drizzle-orm";
import { deleteFile, uploadFile } from "@/lib/cloudinary";
import { getCurrentAdmin } from "@/app/actions/admin";

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

    const slides = await db
      .select()
      .from(homepageHero)
      .orderBy(asc(homepageHero.order));

    return {
      success: true,
      result: slides as HeroSlide[],
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

    const newSlide = await db
      .insert(homepageHero)
      .values({
        imageUrl,
        title: data.title || null,
        subtitle: data.subtitle || null,
        ctaLabel: data.ctaLabel || null,
        ctaLink: data.ctaLink || null,
        order,
        isActive: data.isActive ?? true,
      })
      .returning();

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

    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.ctaLabel !== undefined) updateData.ctaLabel = data.ctaLabel;
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

    const about = await db
      .select()
      .from(homepageAbout)
      .where(eq(homepageAbout.isActive, true))
      .limit(1);

    return {
      success: true,
      result: about[0] as AboutSection | null,
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

    const newAbout = await db
      .insert(homepageAbout)
      .values({
        title: data.title || "Our Story",
        content: data.content || null,
        assetUrl: assetUrl || null,
        isActive: data.isActive ?? true,
      })
      .returning();

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

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

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

    const benefits = await db
      .select()
      .from(homepageBenefits)
      .where(eq(homepageBenefits.isActive, true))
      .limit(1);

    return {
      success: true,
      result: benefits[0] as BenefitsSection | null,
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

    const newBenefits = await db
      .insert(homepageBenefits)
      .values({
        title: data.title || "Why Choose Golden Hive?",
        items: data.items || [],
        isActive: data.isActive ?? true,
      })
      .returning();

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
    if (data.title !== undefined) updateData.title = data.title;
    if (data.items !== undefined) updateData.items = data.items;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

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
