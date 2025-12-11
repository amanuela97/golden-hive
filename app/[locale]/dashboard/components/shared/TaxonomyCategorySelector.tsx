"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchTaxonomyCategories,
  getTaxonomyCategoryDisplay,
} from "@/lib/taxonomy";
import { useDebounce } from "@/hooks/useDebounce";

interface TaxonomyCategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  description?: string;
}

export function TaxonomyCategorySelector({
  value,
  onChange,
  label = "Taxonomy Category",
  required = false,
  error,
  placeholder = "Type to search categories...",
  description,
}: TaxonomyCategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get selected category display name - show only short name in input
  const selectedCategory = useMemo(() => {
    if (!value) return null;
    const category = getTaxonomyCategoryDisplay(value);
    if (!category) return null;
    // Return short name for display in input field
    return {
      ...category,
      displayLabel: category.shortName || category.label,
    };
  }, [value]);

  // Search categories based on debounced query
  // Only search if user has typed at least 1 character to avoid processing entire taxonomy
  const searchResults = useMemo(() => {
    if (!isOpen || !debouncedSearch.trim()) return [];
    return searchTaxonomyCategories(debouncedSearch, 50);
  }, [debouncedSearch, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    setIsOpen(true);

    // If input is cleared, clear selection
    if (!newQuery && value) {
      onChange("");
    }
  };

  const handleSelectCategory = (categoryId: string, categoryLabel: string) => {
    onChange(categoryId);
    // Extract short name from full path for display
    const shortName = categoryLabel.split(" > ").pop() || categoryLabel;
    setSearchQuery(shortName);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Don't trigger search on focus - wait for user to type
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="taxonomy-category-selector">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="taxonomy-category-selector"
          type="text"
          value={searchQuery || selectedCategory?.displayLabel || ""}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={error ? "border-red-500" : ""}
          required={required}
        />
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        {description && !error && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}

        {/* Dropdown Results */}
        {isOpen && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() =>
                  handleSelectCategory(category.value, category.label)
                }
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="text-sm">{category.label}</div>
              </button>
            ))}
            {searchResults.length === 50 && (
              <div className="px-4 py-2 text-xs text-gray-500 border-t">
                Showing first 50 results. Type more to refine search.
              </div>
            )}
          </div>
        )}

        {isOpen && !debouncedSearch.trim() && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500">
            Start typing to search categories...
          </div>
        )}

        {isOpen && debouncedSearch.trim() && searchResults.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500">
            No categories found matching &quot;{debouncedSearch}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
