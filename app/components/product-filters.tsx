"use client";

import { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/app/hooks/useCategoryQueries";
import { ProductFilters as ProductFiltersType } from "@/app/actions/public-products";

interface ProductFiltersProps {
  onFiltersChange: (filters: ProductFiltersType) => void;
}

export function ProductFilters({ onFiltersChange }: ProductFiltersProps) {
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [tempPriceRange, setTempPriceRange] = useState([0, 1000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFeatured, setShowFeatured] = useState(false);
  const isInitialMount = useRef(true);

  const { data: categoriesData, isLoading: categoriesLoading } =
    useCategories();
  const categories = categoriesData?.result || [];

  // Sync temp price range with applied price range
  useEffect(() => {
    setTempPriceRange(priceRange);
  }, [priceRange]);

  // Update filters when local state changes (except price range)
  useEffect(() => {
    // Skip the first render to prevent initial infinite loop
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const filters: ProductFiltersType = {
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      isFeatured: showFeatured || undefined,
    };

    // Add category filter if any categories are selected
    if (selectedCategories.length > 0) {
      // For now, we'll use the first selected category
      // In a more advanced implementation, you might want to support multiple categories
      filters.category = selectedCategories[0];
    }
    onFiltersChange(filters);
  }, [priceRange, selectedCategories, showFeatured, onFiltersChange]);

  const handleCategoryChange = (categoryName: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([categoryName]); // Only allow one category selection for now
    } else {
      setSelectedCategories(
        selectedCategories.filter((cat) => cat !== categoryName)
      );
    }
  };

  const applyPriceFilter = () => {
    setPriceRange([...tempPriceRange]);
  };

  const clearFilters = () => {
    setPriceRange([0, 1000]);
    setTempPriceRange([0, 1000]);
    setSelectedCategories([]);
    setShowFeatured(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Filters</h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Filter by price
        </h3>
        <div className="space-y-4">
          <Slider
            value={tempPriceRange}
            onValueChange={setTempPriceRange}
            min={0}
            max={1000}
            step={10}
            className="w-full"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Price: {tempPriceRange[0]} — {tempPriceRange[1]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={applyPriceFilter}
              className="text-primary"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Product categories
        </h3>
        {categoriesLoading ? (
          <p className="text-sm text-muted-foreground">Loading categories...</p>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={category.id}
                  checked={selectedCategories.includes(category.name)}
                  onCheckedChange={(checked) =>
                    handleCategoryChange(category.name, checked as boolean)
                  }
                />
                <Label
                  htmlFor={category.id}
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {category.name}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">
          Special filters
        </h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="featured"
              checked={showFeatured}
              onCheckedChange={(checked) => setShowFeatured(checked as boolean)}
            />
            <Label
              htmlFor="featured"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Featured products only
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
