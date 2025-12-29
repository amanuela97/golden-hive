"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, isNull, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { slugify } from "@/lib/slug-utils";
import { TaxonomyCategory } from "@/lib/taxonomy";

export interface CategoryNode {
  id: string;
  name: string;
  handle: string;
  level: number;
  fullName: string | null;
  children: CategoryNode[];
}

/**
 * Get category tree (top-level categories with children)
 * This is optimized for navigation dropdowns
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  try {
    // Get all categories from database
    const allCategories = await db.select().from(categories);

    // Build a map for quick lookup
    const categoryMap = new Map<string, CategoryNode>();
    const rootCategories: CategoryNode[] = [];

    // First pass: create all nodes
    for (const cat of allCategories) {
      const node: CategoryNode = {
        id: cat.id,
        name: cat.name,
        handle: cat.handle,
        level: cat.level,
        fullName: cat.fullName,
        children: [],
      };
      categoryMap.set(cat.id, node);
    }

    // Second pass: build tree structure
    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphaned category, treat as root
          rootCategories.push(node);
        }
      } else {
        rootCategories.push(node);
      }
    }

    // Sort by name
    const sortCategories = (cats: CategoryNode[]) => {
      cats.sort((a, b) => a.name.localeCompare(b.name));
      cats.forEach((cat) => sortCategories(cat.children));
    };

    sortCategories(rootCategories);

    return rootCategories;
  } catch (error) {
    console.error("Error fetching category tree:", error);
    return [];
  }
}

/**
 * Get top-level categories only
 */
export async function getTopLevelCategories(): Promise<CategoryNode[]> {
  try {
    const topCategories = await db
      .select()
      .from(categories)
      .where(isNull(categories.parentId))
      .orderBy(categories.name);

    return topCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      handle: cat.handle,
      level: cat.level,
      fullName: cat.fullName,
      children: [],
    }));
  } catch (error) {
    console.error("Error fetching top-level categories:", error);
    return [];
  }
}

/**
 * Get category by handle
 */
export async function getCategoryByHandle(
  handle: string
): Promise<CategoryNode | null> {
  try {
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.handle, handle))
      .limit(1);

    if (category.length === 0) {
      return null;
    }

    const cat = category[0];

    // Get children
    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, cat.id))
      .orderBy(categories.name);

    return {
      id: cat.id,
      name: cat.name,
      handle: cat.handle,
      level: cat.level,
      fullName: cat.fullName,
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        handle: child.handle,
        level: child.level,
        fullName: child.fullName,
        children: [],
      })),
    };
  } catch (error) {
    console.error("Error fetching category by handle:", error);
    return null;
  }
}

/**
 * Search categories by name
 * Returns categories matching the query with their full paths
 */
export async function searchCategories(
  query: string,
  limit: number = 50
): Promise<CategoryNode[]> {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;

    // Search categories by name
    const matchingCategories = await db
      .select()
      .from(categories)
      .where(ilike(categories.name, searchTerm))
      .orderBy(categories.name)
      .limit(limit);

    // Build category map for tree reconstruction
    const allCategories = await db.select().from(categories);
    const categoryMap = new Map<string, CategoryNode>();

    // Create nodes
    for (const cat of allCategories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        handle: cat.handle,
        level: cat.level,
        fullName: cat.fullName,
        children: [],
      });
    }

    // Build tree structure
    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    // Return matching categories with their full tree context
    const results: CategoryNode[] = [];
    for (const cat of matchingCategories) {
      const node = categoryMap.get(cat.id);
      if (node) {
        results.push(node);
      }
    }

    return results;
  } catch (error) {
    console.error("Error searching categories:", error);
    return [];
  }
}

/**
 * Get all descendant category IDs for a given category
 * This is used to fetch products for a top-level category
 */
export async function getDescendantCategoryIds(
  categoryId: string
): Promise<string[]> {
  try {
    const descendants: string[] = [categoryId];

    // Recursive CTE to get all descendants
    const result = await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id
        FROM categories
        WHERE parent_id = ${categoryId}
        
        UNION ALL
        
        SELECT c.id, c.parent_id
        FROM categories c
        INNER JOIN descendants d ON c.parent_id = d.id
      )
      SELECT id FROM descendants
    `);

    // Extract IDs from result
    const rows = result.rows as Array<{ id: string }>;
    descendants.push(...rows.map((row) => row.id));

    return descendants;
  } catch (error) {
    console.error("Error fetching descendant category IDs:", error);
    return [categoryId]; // Fallback to just the category itself
  }
}

/**
 * Sync categories from taxonomy JSON to database
 * This should be run once to populate the categories table
 */
export async function syncCategoriesFromTaxonomy(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    // Import taxonomy data
    const taxonomyData = await import("@/data/categories/taxonomy.json");

    interface TaxonomyVertical {
      name: string;
      prefix: string;
      categories: TaxonomyCategory[];
    }

    interface TaxonomyData {
      version: string;
      verticals: TaxonomyVertical[];
    }

    const data = taxonomyData.default as TaxonomyData;

    if (!data || !data.verticals) {
      return { success: false, count: 0, error: "Invalid taxonomy data" };
    }

    console.log("Building category map...");

    // Step 1: Build a complete map of all categories for O(1) lookups
    // This avoids the expensive findCategoryById() linear searches
    const categoryMap = new Map<string, TaxonomyCategory>();

    const flattenCategories = (cats: TaxonomyCategory[]) => {
      for (const cat of cats) {
        categoryMap.set(cat.id, cat);
        // Note: children are references, not full objects in the JSON structure
        // We'll need to find them from the map when processing
      }
    };

    // Build the map from all verticals
    for (const vertical of data.verticals) {
      flattenCategories(vertical.categories);
    }

    console.log(`Category map built: ${categoryMap.size} categories found`);

    // Step 2: Build list of all categories to sync (in-memory, no DB calls yet)
    const categoriesToSync: Array<{
      id: string;
      name: string;
      handle: string;
      parentId: string | null;
      level: number;
      fullName: string | null;
    }> = [];

    const processed = new Set<string>();

    // Recursive function to collect all categories (no DB calls)
    const collectCategories = (
      category: TaxonomyCategory,
      parentId: string | null = null,
      level: number = 0
    ) => {
      // Avoid processing duplicates
      if (processed.has(category.id)) {
        return;
      }
      processed.add(category.id);

      const handle = slugify(category.name);
      categoriesToSync.push({
        id: category.id,
        name: category.name,
        handle,
        parentId,
        level,
        fullName: category.full_name,
      });

      // Process children using the map (O(1) lookup instead of O(n) search)
      if (category.children && category.children.length > 0) {
        for (const childRef of category.children) {
          const childCategory = categoryMap.get(childRef.id);
          if (childCategory) {
            collectCategories(childCategory, category.id, level + 1);
          } else {
            console.warn(`Child category ${childRef.id} not found in map`);
          }
        }
      }
    };

    // Collect all top-level categories
    for (const vertical of data.verticals) {
      for (const category of vertical.categories) {
        if (category.level === 0) {
          collectCategories(category, null, 0);
        }
      }
    }

    console.log(`Collected ${categoriesToSync.length} categories to sync`);

    // Step 3: Batch insert/update to avoid timeouts
    const batchSize = 50; // Smaller batches for Neon free tier
    let totalProcessed = 0;

    for (let i = 0; i < categoriesToSync.length; i += batchSize) {
      const batch = categoriesToSync.slice(i, i + batchSize);

      // Use transaction for each batch
      await db.transaction(async (tx) => {
        for (const cat of batch) {
          // Check if exists
          const existing = await tx
            .select()
            .from(categories)
            .where(eq(categories.id, cat.id))
            .limit(1);

          if (existing.length > 0) {
            // Update existing
            await tx
              .update(categories)
              .set({
                name: cat.name,
                handle: cat.handle,
                parentId: cat.parentId,
                level: cat.level,
                fullName: cat.fullName,
                updatedAt: new Date(),
              })
              .where(eq(categories.id, cat.id));
          } else {
            // Insert new
            await tx.insert(categories).values(cat);
          }
        }
      });

      totalProcessed += batch.length;
      console.log(
        `Synced ${totalProcessed} / ${categoriesToSync.length} categories (${Math.round((totalProcessed / categoriesToSync.length) * 100)}%)`
      );
    }

    return { success: true, count: categoriesToSync.length };
  } catch (error) {
    console.error("Error syncing categories:", error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
