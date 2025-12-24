/**
 * Slugify a string (convert to URL-friendly format)
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, "") // Remove non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+/, "") // Trim hyphens from start
    .replace(/-+$/, ""); // Trim hyphens from end
}

/**
 * Generate a unique slug by appending numbers if needed
 * Checks against store table and store_slug_history table for uniqueness
 */
export async function generateUniqueSlug(
  db: any,
  baseSlug: string,
  storeId?: string
): Promise<string> {
  const normalized = slugify(baseSlug);
  const slugLower = normalized.toLowerCase();

  // Import here to avoid circular dependencies
  const { store, storeSlugHistory } = await import("@/db/schema");
  const { eq, or } = await import("drizzle-orm");

  // Check if slug exists (excluding current store if updating)
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
    if (existingStore.length > 0 && (!storeId || existingStore[0].id !== storeId)) {
      continue; // Try next candidate
    }

    // Also check slug history
    const existingHistory = await db
      .select()
      .from(storeSlugHistory)
      .where(eq(storeSlugHistory.slugLower, candidateLower))
      .limit(1);

    // If updating, allow current store's slug in history
    if (existingHistory.length === 0 || (storeId && existingHistory[0]?.storeId === storeId)) {
      return candidate;
    }
  }

  throw new Error("Unable to generate unique slug");
}

