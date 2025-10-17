"use client";

import { useState, useCallback, useMemo } from "react";
import { ProductCard } from "@/app/components/product-card";
import { ProductFilters } from "@/app/components/product-filters";
import { useProducts } from "@/app/hooks/useProductQueries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProductFilters as ProductFiltersType,
  PublicProduct,
} from "@/app/actions/public-products";

export default function ProductsPage() {
  const [filters, setFilters] = useState<ProductFiltersType>({});
  const [sortBy, setSortBy] = useState<string>("default");

  const { data: productsData, isLoading, error } = useProducts();

  // Client-side filtering and sorting
  const filteredAndSortedProducts = useMemo(() => {
    if (!productsData?.result) return [];

    let filtered = [...productsData.result];

    // Apply filters
    if (filters.category) {
      filtered = filtered.filter(
        (product) => product.categoryName === filters.category
      );
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(
        (product) => parseFloat(product.price) >= filters.minPrice!
      );
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(
        (product) => parseFloat(product.price) <= filters.maxPrice!
      );
    }

    if (filters.search) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    if (filters.isFeatured) {
      filtered = filtered.filter((product) => product.isFeatured === true);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "name":
          return filters.sortOrder === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case "price":
          const priceA = parseFloat(a.price);
          const priceB = parseFloat(b.price);
          return filters.sortOrder === "asc"
            ? priceA - priceB
            : priceB - priceA;
        case "rating":
          const ratingA = parseFloat(a.ratingAverage || "0");
          const ratingB = parseFloat(b.ratingAverage || "0");
          return filters.sortOrder === "asc"
            ? ratingA - ratingB
            : ratingB - ratingA;
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return filtered;
  }, [productsData?.result, filters]);

  const handleSortChange = useCallback(
    (value: string) => {
      setSortBy(value);
      const newFilters = { ...filters };

      switch (value) {
        case "price-low":
          newFilters.sortBy = "price";
          newFilters.sortOrder = "asc";
          break;
        case "price-high":
          newFilters.sortBy = "price";
          newFilters.sortOrder = "desc";
          break;
        case "name":
          newFilters.sortBy = "name";
          newFilters.sortOrder = "asc";
          break;
        default:
          newFilters.sortBy = "createdAt";
          newFilters.sortOrder = "desc";
      }

      setFilters(newFilters);
    },
    [filters]
  );

  const handleFiltersChange = useCallback((newFilters: ProductFiltersType) => {
    setFilters(newFilters);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-red-500 mb-4">Error loading products</p>
              <p className="text-muted-foreground">Please try again later</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const products = filteredAndSortedProducts;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-12 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main content - left side on desktop */}
          <div className="flex-1 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-8">
              <p className="text-muted-foreground">
                Showing {products.length} results
              </p>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Default sorting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default sorting</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="name">Name: A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  No products found
                </p>
                <p className="text-muted-foreground">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {products.map((product: PublicProduct) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          {/* Filters - right side on desktop */}
          <aside className="w-full lg:w-80 order-1 lg:order-2">
            <ProductFilters onFiltersChange={handleFiltersChange} />
          </aside>
        </div>
      </div>
    </div>
  );
}
