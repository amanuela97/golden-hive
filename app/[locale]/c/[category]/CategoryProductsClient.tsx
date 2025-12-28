"use client";

import { ProductCard } from "@/app/[locale]/components/product-card";
import { Button } from "@/components/ui/button";
import { CategoryNode } from "@/app/[locale]/actions/categories";
import { PublicProduct } from "@/app/[locale]/actions/public-products";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { slugify } from "@/lib/slug-utils";

interface CategoryProductsClientProps {
  category: CategoryNode & { ancestors?: Array<{ id: string; name: string }> };
  initialProducts: PublicProduct[];
  initialPage: number;
  totalProducts: number;
  totalPages: number;
}

// Build breadcrumb path from category ancestors
function buildBreadcrumbs(
  category: CategoryProductsClientProps["category"]
): Array<{ name: string; id: string; isCurrent: boolean }> {
  const breadcrumbs: Array<{ name: string; id: string; isCurrent: boolean }> = [];
  
  // Add all ancestors
  if (category.ancestors && category.ancestors.length > 0) {
    for (const ancestor of category.ancestors) {
      breadcrumbs.push({
        name: ancestor.name,
        id: ancestor.id,
        isCurrent: false,
      });
    }
  }
  
  // Add current category
  breadcrumbs.push({
    name: category.name,
    id: category.id,
    isCurrent: true,
  });
  
  return breadcrumbs;
}

// Build URL for a category using the full_name path
function buildCategoryUrl(
  categoryId: string,
  categoryName: string,
  fullName: string | null,
  ancestorIndex: number
): string {
  if (!fullName) {
    // Fallback: just use the category name
    return `/c/${slugify(categoryName)}?id=${encodeURIComponent(categoryId)}`;
  }
  
  // Split full_name and build path up to the ancestor's position
  const parts = fullName.split(" > ");
  const pathParts = parts.slice(0, ancestorIndex + 1).map((part) => slugify(part));
  
  return `/c/${pathParts.join("/")}?id=${encodeURIComponent(categoryId)}`;
}

export function CategoryProductsClient({
  category,
  initialProducts,
  initialPage,
  totalProducts,
  totalPages,
}: CategoryProductsClientProps) {
  const breadcrumbs = buildBreadcrumbs(category);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </Link>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm flex-wrap">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {crumb.isCurrent ? (
                <span className="text-muted-foreground">{crumb.name}</span>
              ) : (
                <Link
                  href={buildCategoryUrl(
                    crumb.id,
                    crumb.name,
                    category.fullName,
                    index
                  )}
                  className="underline hover:text-primary transition-colors"
                >
                  {crumb.name}
                </Link>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Category Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {totalProducts} product{totalProducts !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Products Grid */}
      {initialProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No products found in this category.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {initialProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <Button
                variant="outline"
                disabled={initialPage === 1}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("page", String(initialPage - 1));
                  window.location.href = `?${params.toString()}`;
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {initialPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={initialPage >= totalPages}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("page", String(initialPage + 1));
                  window.location.href = `?${params.toString()}`;
                }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
