"use client";

import { useState, useCallback, useMemo } from "react";
import { ProductCard } from "../components/product-card";
import { ProductFilters } from "../components/product-filters";
import { useProducts } from "../hooks/useProductQueries";
import { useTranslations } from "next-intl";
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
} from "../actions/public-products";

// Skeleton component for loading state
function ProductSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-gray-200 rounded-lg h-64 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const [filters, setFilters] = useState<ProductFiltersType>({});
  const [sortBy, setSortBy] = useState<string>("default");
  const t = useTranslations("products");

  const { data: productsData, isLoading, error } = useProducts();

  // Show loading state if we don't have data yet or if explicitly loading
  const showLoading = isLoading || !productsData;

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

  if (showLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-12 py-12">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Main content - left side on desktop */}
            <div className="flex-1 order-2 lg:order-1">
              <div className="flex items-center justify-between mb-8">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded w-[200px] animate-pulse"></div>
              </div>
              <ProductSkeleton />
            </div>

            {/* Filters - right side on desktop */}
            <aside className="w-full lg:w-80 order-1 lg:order-2">
              <div className="space-y-6">
                <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-red-500 mb-4">{t("errorLoading")}</p>
              <p className="text-muted-foreground">{t("tryAgainLater")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const products = filteredAndSortedProducts;

  return (
    <div className="bg-background">
      <div className="container mx-auto px-12 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main content - left side on desktop */}
          <div className="flex-1 order-2 lg:order-1">
            <div className="flex items-center justify-between mb-8">
              <p className="text-muted-foreground">
                {t("showingResults", { count: products.length })}
              </p>
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t("defaultSorting")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("defaultSorting")}</SelectItem>
                  <SelectItem value="price-low">
                    {t("priceLowToHigh")}
                  </SelectItem>
                  <SelectItem value="price-high">
                    {t("priceHighToLow")}
                  </SelectItem>
                  <SelectItem value="name">{t("nameAToZ")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12 min-h-[400px] flex flex-col justify-center">
                <p className="text-muted-foreground text-lg">
                  {t("noProductsFound")}
                </p>
                <p className="text-muted-foreground">{t("adjustFilters")}</p>
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
