"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { searchProducts, SearchResult } from "../actions/search";
import { ProductCard } from "../components/product-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export function SearchResultsClient({
  initialQuery,
  initialPage,
}: {
  initialQuery: string;
  initialPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(initialPage);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Get current query and page from URL params
  const currentQuery = searchParams.get("q") || initialQuery;
  const urlPage = parseInt(searchParams.get("page") || "1", 10);
  const debouncedQuery = useDebounce(currentQuery, 300);

  // Sync page state with URL params when URL changes
  useEffect(() => {
    if (urlPage !== page) {
      setPage(urlPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPage]);

  // Fetch search results
  useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setTotal(0);
        setTotalPages(0);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await searchProducts(debouncedQuery.trim(), "en", {
          page,
          limit: 24,
        });

        if (response.success) {
          setResults(response.results);
          setTotal(response.total);
          setTotalPages(response.totalPages);
        } else {
          setError(response.error || "Search failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [debouncedQuery, page]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    const newUrl = params.toString()
      ? `/search?${params.toString()}`
      : "/search";
    router.push(newUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {/* Results Header */}
      {debouncedQuery.trim() && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? (
              "Searching..."
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              `Found ${total} result${total !== 1 ? "s" : ""} for "${debouncedQuery}"`
            )}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {results
              .filter((result) => result.type === "product")
              .map((result) => (
                <ProductCard
                  key={result.id}
                  product={{
                    id: result.id,
                    name: result.name,
                    description: result.description || null,
                    imageUrl: result.imageUrl || null,
                    price: result.price || "0",
                    compareAtPrice: null,
                    currency: "EUR",
                    unit: "kg",
                    category: result.categoryName || null,
                    categoryName: result.categoryName || null,
                    gallery: null,
                    tags: null,
                    stockQuantity: null,
                    isActive: true,
                    isFeatured: false,
                    marketType: null,
                    originVillage: null,
                    harvestDate: null,
                    ratingAverage: null,
                    ratingCount: null,
                    salesCount: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    storeName: result.storeName || null,
                    storeSlug: result.storeSlug || null,
                  }}
                />
              ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <Button
                variant="outline"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* No Results */}
      {!loading && !error && debouncedQuery.trim() && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No results found for &quot;{debouncedQuery}&quot;
          </p>
        </div>
      )}

      {/* Empty State */}
      {!debouncedQuery.trim() && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Enter a search query to find products, stores, or categories
          </p>
        </div>
      )}
    </div>
  );
}
