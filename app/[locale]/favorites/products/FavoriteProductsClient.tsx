"use client";

import { ProductCard } from "@/app/[locale]/components/product-card";
import { PublicProduct } from "@/app/[locale]/actions/public-products";

interface FavoriteProductsClientProps {
  initialProducts: PublicProduct[];
}

export function FavoriteProductsClient({
  initialProducts,
}: FavoriteProductsClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Favorite Products</h1>
        <p className="text-muted-foreground">All your favorite products</p>
      </div>

      {initialProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            You haven&apos;t favorited any products yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {initialProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

