"use client";

import { useState, useEffect } from "react";
import { getGuestFavorites } from "@/lib/guest-favorites";
import {
  getPublicProducts,
  PublicProduct,
} from "@/app/[locale]/actions/public-products";
import { ProductCard } from "@/app/[locale]/components/product-card";

export function GuestFavoriteProductsClient() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      const favorites = getGuestFavorites();

      if (favorites.products.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const productIds = favorites.products.map((f) => f.id);
        const productsResult = await getPublicProducts({ limit: 1000 });
        const filteredProducts = productsResult.result?.filter((p) =>
          productIds.includes(p.id)
        );
        setProducts(filteredProducts || []);
      } catch (error) {
        console.error("Error loading favorite products:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) {
    return <div>Loading favorite products...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Favorite Products</h1>
        <p className="text-muted-foreground">All your favorite products</p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            You haven&apos;t favorited any products yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
