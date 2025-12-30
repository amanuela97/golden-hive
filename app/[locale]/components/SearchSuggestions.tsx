"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { searchAll, SearchResult } from "@/app/[locale]/actions/search";
import { Search, Package, Store, Tag, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SearchSuggestionsProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export function SearchSuggestions({
  query,
  isOpen,
  onClose,
  onSelect,
}: SearchSuggestionsProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const isClickingInsideRef = useRef(false);

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await searchAll(debouncedQuery.trim(), "en");
        if (result.success) {
          setSuggestions(result.results.slice(0, 8)); // Limit to 8 suggestions
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSuggestionClick = useCallback(
    (suggestion: SearchResult) => {
      onSelect();
      let url = "";

      if (suggestion.type === "product") {
        // Always use slug if available, fallback to id only if slug is missing
        if (suggestion.slug) {
          url = `/products/${suggestion.slug}`;
        } else {
          // Fallback to id if slug is not available (shouldn't happen in normal cases)
          console.warn(
            "Product suggestion missing slug, using id:",
            suggestion
          );
          url = `/products/${suggestion.id}`;
        }
      } else if (suggestion.type === "store") {
        if (!suggestion.slug) {
          console.warn("Store suggestion missing slug:", suggestion);
          return;
        }
        url = `/store/${suggestion.slug}`;
      } else if (suggestion.type === "category") {
        url = `/c?id=${encodeURIComponent(suggestion.id)}`;
      }

      if (url) {
        router.push(url);
        onClose();
      }
    },
    [router, onSelect, onClose]
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSuggestionClick(suggestions[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, suggestions, selectedIndex, onClose, handleSuggestionClick]);

  // Handle clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // If we just clicked inside, don't close
      if (isClickingInsideRef.current) {
        isClickingInsideRef.current = false;
        return;
      }

      const target = event.target as Node;

      // Don't close if clicking inside the container
      if (containerRef.current?.contains(target)) {
        return;
      }

      // Don't close if clicking on the search input
      if (target instanceof Element && target.closest('input[type="search"]')) {
        return;
      }

      // Close if clicking outside
      onClose();
    };

    // Use click event instead of mousedown to allow button clicks to process first
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Group suggestions by type
  const products = suggestions.filter((s) => s.type === "product");
  const stores = suggestions.filter((s) => s.type === "store");
  const categories = suggestions.filter((s) => s.type === "category");

  if (!isOpen || !debouncedQuery.trim() || debouncedQuery.length < 2) {
    return null;
  }

  const renderSuggestion = (
    suggestion: SearchResult,
    index: number,
    icon: React.ReactNode
  ) => {
    const isSelected = index === selectedIndex;
    const globalIndex = suggestions.indexOf(suggestion);

    return (
      <button
        key={`${suggestion.type}-${suggestion.id}`}
        type="button"
        onMouseDown={() => {
          // Mark that we're clicking inside to prevent outside click handler from firing
          isClickingInsideRef.current = true;
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSuggestionClick(suggestion);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent/50"
        )}
        onMouseEnter={() => setSelectedIndex(globalIndex)}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {suggestion.imageUrl ? (
            <Image
              src={suggestion.imageUrl}
              alt={suggestion.name}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="text-muted-foreground">{icon}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{suggestion.name}</div>
          {suggestion.type === "product" && (
            <div className="text-xs text-muted-foreground truncate">
              {suggestion.price && (
                <span className="font-semibold text-primary">
                  {suggestion.price} {suggestion.storeName && "• "}
                </span>
              )}
              {suggestion.storeName}
            </div>
          )}
          {suggestion.type === "store" && (
            <div className="text-xs text-muted-foreground">Store</div>
          )}
          {suggestion.type === "category" && (
            <div className="text-xs text-muted-foreground">Category</div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No results found for &quot;{debouncedQuery}&quot;
        </div>
      ) : (
        <div className="py-2">
          {products.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Products
              </div>
              {products.map((product) => {
                const globalIndex = suggestions.indexOf(product);
                return renderSuggestion(
                  product,
                  globalIndex,
                  <Package className="h-5 w-5" />
                );
              })}
            </div>
          )}

          {stores.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Stores
              </div>
              {stores.map((store) => {
                const globalIndex = suggestions.indexOf(store);
                return renderSuggestion(
                  store,
                  globalIndex,
                  <Store className="h-5 w-5" />
                );
              })}
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Categories
              </div>
              {categories.map((category) => {
                const globalIndex = suggestions.indexOf(category);
                return renderSuggestion(
                  category,
                  globalIndex,
                  <Tag className="h-5 w-5" />
                );
              })}
            </div>
          )}

          <div className="border-t mt-2 pt-2">
            <button
              type="button"
              onMouseDown={() => {
                // Mark that we're clicking inside to prevent outside click handler from firing
                isClickingInsideRef.current = true;
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/search?q=${encodeURIComponent(debouncedQuery)}`);
                onSelect();
                onClose();
              }}
              className="w-full px-4 py-2 text-sm text-primary hover:bg-accent/50 transition-colors flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              View all results for &quot;{debouncedQuery}&quot;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
