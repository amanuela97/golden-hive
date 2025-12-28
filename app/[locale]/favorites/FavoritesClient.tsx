"use client";

import { useState, useEffect } from "react";
import { ProductCard } from "@/app/[locale]/components/product-card";
import { StoreCard } from "@/app/[locale]/stores/components/StoreCard";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import Link from "next/link";
import { PublicProduct } from "@/app/[locale]/actions/public-products";
import { useSession } from "@/lib/auth-client";
import { getGuestFavorites } from "@/lib/guest-favorites";
import { getPublicProducts } from "@/app/[locale]/actions/public-products";
import { listPublicStores } from "@/app/[locale]/actions/storefront";

interface Store {
  id: string;
  storeName: string;
  slug: string;
  logoUrl?: string | null;
  ratingAvg: number | string;
  ratingCount: number;
  followerCount: number;
  bannerUrl?: string;
}

interface FavoritesClientProps {
  initialProducts: PublicProduct[];
  initialStores: Store[];
}

export function FavoritesClient({
  initialProducts,
  initialStores,
}: FavoritesClientProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [products, setProducts] = useState(initialProducts);
  const [stores, setStores] = useState(initialStores);
  const [loading, setLoading] = useState(!isAuthenticated);

  // Load guest favorites if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      async function loadGuestFavorites() {
        try {
          const guestFavorites = getGuestFavorites();

          // Load guest favorite products
          if (guestFavorites.products.length > 0) {
            const productIds = guestFavorites.products.map((f) => f.id);
            const productsResult = await getPublicProducts({ limit: 1000 });
            const filteredProducts = productsResult.result?.filter((p) =>
              productIds.includes(p.id)
            ) || [];
            setProducts(filteredProducts);
          }

          // Load guest favorite stores
          if (guestFavorites.stores.length > 0) {
            const storeIds = guestFavorites.stores.map((f) => f.id);
            const storesResult = await listPublicStores({ limit: 1000 });
            const filteredStores = storesResult.filter((s: Store) =>
              storeIds.includes(s.id)
            );
            setStores(filteredStores);
          }
        } catch (error) {
          console.error("Error loading guest favorites:", error);
        } finally {
          setLoading(false);
        }
      }

      loadGuestFavorites();
    }
  }, [isAuthenticated]);

  const hasFavorites = products.length > 0 || stores.length > 0;
  const hasMoreProducts = products.length > 6;
  const hasMoreStores = stores.length > 6;

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading favorites...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
        <p className="text-muted-foreground">Your saved products and stores</p>
      </div>

      {!hasFavorites ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            You haven&apos;t favorited any products or stores yet.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link href="/products">Browse Products</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/stores">Browse Stores</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Products Section */}
          {products.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Favorite Products</h2>
                {hasMoreProducts && (
                  <Button variant="link" asChild>
                    <Link href="/favorites/products">View More</Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {products.slice(0, 6).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Stores Section */}
          {stores.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Favorite Stores</h2>
                {hasMoreStores && (
                  <Button variant="link" asChild>
                    <Link href="/favorites/stores">View More</Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {stores.slice(0, 6).map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

