"use client";

import { ProductCard } from "@/app/[locale]/components/product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CategoryNode } from "@/app/[locale]/actions/categories";
import { PublicProduct } from "@/app/[locale]/actions/public-products";

interface SubcategoryProductsClientProps {
  parentCategory: CategoryNode;
  subcategory: CategoryNode;
  initialProducts: PublicProduct[];
  initialPage: number;
  totalProducts: number;
  totalPages: number;
}

export function SubcategoryProductsClient({
  parentCategory,
  subcategory,
  initialProducts,
  initialPage,
  totalProducts,
  totalPages,
}: SubcategoryProductsClientProps) {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          All Products
        </Link>
        {" / "}
        <Link
          href={`/c/${parentCategory.handle}`}
          className="hover:text-foreground"
        >
          {parentCategory.name}
        </Link>
        {" / "}
        <span className="text-foreground">{subcategory.name}</span>
      </nav>

      {/* Category Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">{subcategory.name}</h1>
        <p className="text-muted-foreground">
          {subcategory.fullName ||
            `${parentCategory.name} > ${subcategory.name}`}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {totalProducts} product{totalProducts !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Products Grid */}
      {initialProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No products found in this subcategory.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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
