/**
 * Taxonomy helper functions
 * These functions work with the taxonomy JSON file to flatten categories
 * and find categories by ID.
 */

import taxonomyData from "@/data/categories/taxonomy.json";

export interface TaxonomyAttribute {
  id: string;
  name: string;
  handle: string;
  description?: string;
  extended: boolean;
}

export interface TaxonomyCategory {
  id: string;
  level: number;
  name: string;
  full_name: string;
  parent_id: string | null;
  attributes: TaxonomyAttribute[];
  children: Array<{ id: string; name: string }>;
  ancestors: Array<{ id: string; name: string }>;
  description?: string; // Optional description field
}

interface TaxonomyVertical {
  name: string;
  prefix: string;
  categories: TaxonomyCategory[];
}

interface TaxonomyData {
  version: string;
  verticals: TaxonomyVertical[];
}

export interface FlattenedCategory {
  id: string;
  fullName: string;
  level: number;
}

/**
 * Flatten the taxonomy tree into a list of categories with breadcrumb paths
 * Returns all categories sorted by their full_name (breadcrumb path)
 */
export function flattenTaxonomy(): FlattenedCategory[] {
  const flattened: FlattenedCategory[] = [];

  function traverse(categories: TaxonomyCategory[]) {
    for (const category of categories) {
      flattened.push({
        id: category.id,
        fullName: category.full_name,
        level: category.level,
      });

      // If category has children, we need to find them in the full list
      // The taxonomy structure has children as references, so we need to
      // recursively find the actual category objects
      if (category.children && category.children.length > 0) {
        // Find child categories by their IDs
        const childCategories = category.children
          .map((child) => findCategoryById(child.id))
          .filter((cat): cat is TaxonomyCategory => cat !== null);

        if (childCategories.length > 0) {
          traverse(childCategories);
        }
      }
    }
  }

  // Traverse all verticals
  const data = taxonomyData as TaxonomyData;
  if (!data || !data.verticals) {
    return [];
  }

  for (const vertical of data.verticals) {
    traverse(vertical.categories);
  }

  // Sort by full name for better UX
  return flattened.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Find a category by its ID in the taxonomy
 * This function searches through all categories, so it can be slow for large taxonomies.
 * Consider caching results if called frequently.
 */
export function findCategoryById(categoryId: string): TaxonomyCategory | null {
  const data = taxonomyData as TaxonomyData;
  if (!data || !data.verticals) {
    return null;
  }

  // Early return if categoryId is empty
  if (!categoryId) {
    return null;
  }

  for (const vertical of data.verticals) {
    for (const category of vertical.categories) {
      if (category.id === categoryId) {
        return category;
      }
    }
  }
  return null;
}

/**
 * Get all categories as a flat list for use in dropdowns
 * This is optimized for the product form selector
 * NOTE: This can be slow for large taxonomies. Consider using searchTaxonomyCategories instead.
 */
export function getTaxonomyCategoriesForSelect(): Array<{
  value: string;
  label: string;
}> {
  const flattened = flattenTaxonomy();
  return flattened.map((cat) => ({
    value: cat.id,
    label: cat.fullName,
  }));
}

/**
 * Search taxonomy categories by query string
 * This is more efficient as it searches directly without flattening everything
 */
export function searchTaxonomyCategories(
  query: string,
  limit: number = 100
): Array<{ value: string; label: string }> {
  const data = taxonomyData as TaxonomyData;
  if (!data || !data.verticals) {
    return [];
  }

  const results: Array<{ value: string; label: string }> = [];
  const searchLower = query.toLowerCase().trim();

  // If query is empty, return top-level categories only
  if (!searchLower) {
    for (const vertical of data.verticals) {
      for (const category of vertical.categories) {
        if (category.level === 0) {
          results.push({
            value: category.id,
            label: category.full_name,
          });
          if (results.length >= limit) return results;
        }
      }
    }
    return results;
  }

  // Search through all categories
  for (const vertical of data.verticals) {
    for (const category of vertical.categories) {
      // Check if category name or full_name matches the query
      if (
        category.name.toLowerCase().includes(searchLower) ||
        category.full_name.toLowerCase().includes(searchLower)
      ) {
        results.push({
          value: category.id,
          label: category.full_name,
        });
        if (results.length >= limit) return results;
      }
    }
  }

  // Sort by relevance (exact matches first, then by position in full_name)
  return results.sort((a, b) => {
    const aExact = a.label.toLowerCase().startsWith(searchLower);
    const bExact = b.label.toLowerCase().startsWith(searchLower);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Get a category by ID and return its display info
 */
export function getTaxonomyCategoryDisplay(
  categoryId: string
): { value: string; label: string; shortName: string } | null {
  const category = findCategoryById(categoryId);
  if (!category) return null;
  return {
    value: category.id,
    label: category.full_name,
    shortName: category.name, // Just the short name (e.g., "Honey")
  };
}

/**
 * Extract short name from full name (fallback if category not found)
 */
export function extractCategoryShortName(fullName: string): string {
  // Split by " > " and get the last part
  const parts = fullName.split(" > ");
  return parts[parts.length - 1] || fullName;
}

/**
 * Get attributes for a category by ID
 */
export function getCategoryAttributes(categoryId: string): TaxonomyAttribute[] {
  const category = findCategoryById(categoryId);
  if (!category || !category.attributes) {
    return [];
  }
  return category.attributes;
}

/**
 * Get all descendant category IDs from a given category ID (recursive)
 * This includes the category itself and all its children, grandchildren, etc.
 */
export function getDescendantTaxonomyIds(categoryId: string): string[] {
  const categoryMap = new Map<string, TaxonomyCategory>();
  const data = taxonomyData as TaxonomyData;

  // Build category map
  for (const vertical of data.verticals) {
    for (const cat of vertical.categories) {
      categoryMap.set(cat.id, cat);
    }
  }

  const category = categoryMap.get(categoryId);
  if (!category) {
    return [categoryId]; // Return just the ID if category not found
  }

  const descendants: string[] = [categoryId];

  const collectDescendants = (cat: TaxonomyCategory) => {
    if (cat.children && cat.children.length > 0) {
      for (const childRef of cat.children) {
        const child = categoryMap.get(childRef.id);
        if (child) {
          descendants.push(child.id);
          collectDescendants(child);
        }
      }
    }
  };

  collectDescendants(category);
  return descendants;
}
