"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Grid3x3, Search, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import taxonomyData from "@/data/categories/taxonomy.json";
import { TaxonomyCategory } from "@/lib/taxonomy";
import { slugify } from "@/lib/slug-utils";

interface TaxonomyVertical {
  name: string;
  prefix: string;
  categories: TaxonomyCategory[];
}

interface TaxonomyData {
  version: string;
  verticals: TaxonomyVertical[];
}

// Build category map for O(1) lookups
function buildCategoryMap(): Map<string, TaxonomyCategory> {
  const data = taxonomyData as TaxonomyData;
  const categoryMap = new Map<string, TaxonomyCategory>();

  // Add all categories to the map
  for (const vertical of data.verticals) {
    for (const cat of vertical.categories) {
      categoryMap.set(cat.id, cat);
    }
  }

  return categoryMap;
}

// Get top-level categories (level 0)
function getTopLevelCategories(): TaxonomyCategory[] {
  const data = taxonomyData as TaxonomyData;
  const topLevel: TaxonomyCategory[] = [];

  for (const vertical of data.verticals) {
    for (const category of vertical.categories) {
      if (category.level === 0) {
        topLevel.push(category);
      }
    }
  }

  return topLevel.sort((a, b) => a.name.localeCompare(b.name));
}

// Get full child category objects from references
function getChildCategories(
  childRefs: Array<{ id: string; name: string }>,
  categoryMap: Map<string, TaxonomyCategory>
): TaxonomyCategory[] {
  return childRefs
    .map((ref) => categoryMap.get(ref.id))
    .filter((cat): cat is TaxonomyCategory => cat !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface CategoryMenuItemProps {
  category: TaxonomyCategory;
  level: number;
  maxLevel: number;
  categoryMap: Map<string, TaxonomyCategory>;
  onNavigate?: () => void;
}

// Recursive component for rendering category menu items
function CategoryMenuItem({
  category,
  level,
  maxLevel,
  categoryMap,
  onNavigate,
}: CategoryMenuItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const childCategories = useMemo(
    () => getChildCategories(category.children || [], categoryMap),
    [category.children, categoryMap]
  );

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (childCategories.length > 0 && level < maxLevel) {
      setIsOpen(true);
    }
  }, [childCategories.length, level, maxLevel]);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  // Build URL using taxonomy ID
  const buildCategoryUrl = (cat: TaxonomyCategory): string => {
    // Use slug from full_name for URL, but include taxonomy ID as query param
    if (cat.full_name) {
      const parts = cat.full_name.split(" > ");
      const slugs = parts.map((part) => slugify(part));
      return `/c/${slugs.join("/")}?id=${encodeURIComponent(cat.id)}`;
    }
    return `/c/${slugify(cat.name)}?id=${encodeURIComponent(cat.id)}`;
  };

  const categoryUrl = buildCategoryUrl(category);
  const hasChildren = childCategories.length > 0 && level < maxLevel;

  if (hasChildren) {
    return (
      <DropdownMenuSub open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuSubTrigger
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="cursor-pointer"
        >
          <span>{category.name}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          className="w-48 max-h-[400px] overflow-y-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Link to view all items in this category */}
          <DropdownMenuItem asChild onSelect={onNavigate}>
            <Link href={categoryUrl}>
              <span className="text-sm font-medium">All {category.name}</span>
            </Link>
          </DropdownMenuItem>
          {childCategories.length > 0 && <DropdownMenuSeparator />}
          {/* Render children recursively */}
          {childCategories.map((child) => (
            <CategoryMenuItem
              key={child.id}
              category={child}
              level={level + 1}
              maxLevel={maxLevel}
              categoryMap={categoryMap}
              onNavigate={onNavigate}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  // Leaf category
  return (
    <DropdownMenuItem asChild onSelect={onNavigate}>
      <Link href={categoryUrl}>
        <span className="text-sm">{category.name}</span>
      </Link>
    </DropdownMenuItem>
  );
}

// Flatten categories for search
function flattenCategoriesForSearch(
  categories: TaxonomyCategory[],
  query: string,
  categoryMap: Map<string, TaxonomyCategory>
): Array<{ category: TaxonomyCategory; path: string[] }> {
  const searchLower = query.toLowerCase().trim();
  const results: Array<{ category: TaxonomyCategory; path: string[] }> = [];

  const flattenRecursive = (
    cats: TaxonomyCategory[],
    path: string[] = []
  ): void => {
    for (const cat of cats) {
      const currentPath = [...path, cat.name];
      const matches =
        cat.name.toLowerCase().includes(searchLower) ||
        cat.full_name?.toLowerCase().includes(searchLower);

      if (matches) {
        results.push({ category: cat, path: currentPath });
      }

      const children = getChildCategories(cat.children || [], categoryMap);
      if (children.length > 0) {
        flattenRecursive(children, currentPath);
      }
    }
  };

  flattenRecursive(categories);
  return results.slice(0, 50);
}

export function CategoryNavClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Build category map once (memoized)
  const categoryMap = useMemo(() => buildCategoryMap(), []);

  // Get top-level categories once (memoized)
  const topLevelCategories = useMemo(() => getTopLevelCategories(), []);

  // Filter categories for search
  const searchResults = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    return flattenCategoriesForSearch(
      topLevelCategories,
      debouncedSearch,
      categoryMap
    );
  }, [debouncedSearch, topLevelCategories, categoryMap]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchMode(value.trim().length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearchMode(false);
  };

  // Build URL for a category using taxonomy ID
  const buildCategoryUrl = (category: TaxonomyCategory): string => {
    if (category.full_name) {
      const parts = category.full_name.split(" > ");
      const slugs = parts.map((part) => slugify(part));
      return `/c/${slugs.join("/")}?id=${encodeURIComponent(category.id)}`;
    }
    return `/c/${slugify(category.name)}?id=${encodeURIComponent(category.id)}`;
  };

  if (topLevelCategories.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 bg-background hover:bg-accent/10 transition-colors group"
          >
            <Grid3x3 className="h-4 w-4 group-hover:text-primary transition-colors" />
            Browse Categories
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-64 max-h-[600px] overflow-y-auto z-[9999]"
          align="start"
        >
          {/* Search Input */}
          <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search categories..."
                className="pl-8 pr-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearSearch();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Search Results */}
          {isSearchMode && (
            <>
              {searchResults.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  {searchResults.map(({ category, path }) => (
                    <DropdownMenuItem key={category.id} asChild>
                      <Link href={buildCategoryUrl(category)}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {category.name}
                          </span>
                          {path.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                              {path.join(" > ")}
                            </span>
                          )}
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              ) : (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No categories found
                </div>
              )}
            </>
          )}

          {/* Regular Category Menu (when not searching) */}
          {!isSearchMode && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/products">
                  <span className="font-semibold">All Categories</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Show only top-level categories from taxonomy */}
              {topLevelCategories.map((category) => (
                <CategoryMenuItem
                  key={category.id}
                  category={category}
                  level={0}
                  maxLevel={7}
                  categoryMap={categoryMap}
                />
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
