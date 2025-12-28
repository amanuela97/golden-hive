/**
 * Utility functions for generating URL-friendly slugs
 */

import { store, storeSlugHistory, listing, listingSlugHistory } from "@/db/schema";
import { eq, or } from "drizzle-orm";

/**
 * Convert a string to a URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug for a store
 * Checks both the store table and slug history to ensure uniqueness
 * @param db - Database instance (can be transaction)
 * @param baseSlug - Base slug to make unique
 * @param storeId - Optional store ID to exclude when updating
 * @returns A unique slug
 */
export async function generateUniqueSlug(
  db: any,
  baseSlug: string,
  storeId?: string
): Promise<string> {
  const normalized = slugify(baseSlug);
  const slugLower = normalized.toLowerCase();

  // Try up to 50 variations
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? normalized : `${normalized}-${i + 1}`;
    const candidateLower = candidate.toLowerCase();

    // Check store table
    const existingStore = await db
      .select({ id: store.id })
      .from(store)
      .where(eq(store.slugLower, candidateLower))
      .limit(1);

    // If updating, allow current store's slug
    if (
      existingStore.length > 0 &&
      (!storeId || existingStore[0].id !== storeId)
    ) {
      continue; // Try next candidate
    }

    // Also check slug history
    const existingHistory = await db
      .select()
      .from(storeSlugHistory)
      .where(
        or(
          eq(storeSlugHistory.slugLower, candidateLower),
          eq(storeSlugHistory.slug, candidate)
        )
      )
      .limit(1);

    if (existingHistory.length === 0) {
      return candidate; // Found unique slug
    }
  }

  // Fallback: append timestamp if all variations are taken
  return `${normalized}-${Date.now()}`;
}

/**
 * Generate a unique slug for a listing/product
 * Checks both the listing table and slug history to ensure uniqueness
 * @param db - Database instance (can be transaction)
 * @param baseSlug - Base slug to make unique
 * @param listingId - Optional listing ID to exclude when updating
 * @returns A unique slug
 */
export async function generateUniqueListingSlug(
  db: any,
  baseSlug: string,
  listingId?: string
): Promise<string> {
  const normalized = slugify(baseSlug);
  const slugLower = normalized.toLowerCase();

  // Try up to 50 variations
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? normalized : `${normalized}-${i + 1}`;
    const candidateLower = candidate.toLowerCase();

    // Check listing table
    const existingListing = await db
      .select({ id: listing.id })
      .from(listing)
      .where(eq(listing.slugLower, candidateLower))
      .limit(1);

    // If updating, allow current listing's slug
    if (
      existingListing.length > 0 &&
      (!listingId || existingListing[0].id !== listingId)
    ) {
      continue; // Try next candidate
    }

    // Also check slug history
    const existingHistory = await db
      .select()
      .from(listingSlugHistory)
      .where(
        or(
          eq(listingSlugHistory.slugLower, candidateLower),
          eq(listingSlugHistory.slug, candidate)
        )
      )
      .limit(1);

    if (existingHistory.length === 0) {
      return candidate; // Found unique slug
    }
  }

  // Fallback: append timestamp if all variations are taken
  return `${normalized}-${Date.now()}`;
}

