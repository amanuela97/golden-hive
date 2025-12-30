"use client";

import { useState, useEffect } from "react";
import { getGuestFavorites, getExpiryDate } from "@/lib/guest-favorites";
import {
  getPublicProducts,
  type PublicProduct,
} from "@/app/[locale]/actions/public-products";
import { listPublicStores } from "@/app/[locale]/actions/storefront";
import { ProductCard } from "@/app/[locale]/components/product-card";
import { StoreCard } from "@/app/[locale]/stores/components/StoreCard";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Heart, AlertCircle } from "lucide-react";
import Link from "next/link";

interface PublicStore {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  ratingAvg: string | number;
  ratingCount: number;
  followerCount: number;
  bannerUrl?: string;
}

export function GuestFavoritesClient() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState<string>("");

  useEffect(() => {
    async function loadFavorites() {
      setExpiryDate(getExpiryDate());
      const favorites = getGuestFavorites();

      if (favorites.products.length === 0 && favorites.stores.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Load products
        if (favorites.products.length > 0) {
          const productIds = favorites.products.map((f) => f.id);
          const productsResult = await getPublicProducts({
            limit: 1000,
            locale: "en",
          });
          const filteredProducts =
            productsResult.result?.filter((p) => productIds.includes(p.id)) ||
            [];
          setProducts(filteredProducts);
        }

        // Load stores
        if (favorites.stores.length > 0) {
          const storeIds = favorites.stores.map((f) => f.id);
          const storesResult = await listPublicStores({ limit: 1000 });
          const filteredStores = storesResult.filter((s) =>
            storeIds.includes(s.id)
          );
          setStores(filteredStores);
        }
      } catch (error) {
        console.error("Error loading favorites:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, []);

  if (loading) {
    return <div>Loading favorites...</div>;
  }

  const hasFavorites = products.length > 0 || stores.length > 0;
  const hasMoreProducts = getGuestFavorites().products.length > 6;
  const hasMoreStores = getGuestFavorites().stores.length > 6;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
        <p className="text-muted-foreground">
          Your saved products and stores (expires {expiryDate})
        </p>
      </div>

      {/* Sign-in Banner */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sign in to save favorites permanently</AlertTitle>
        <AlertDescription>
          Your favorites are currently saved locally and will expire after 7
          days or if you clear your browser cache.{" "}
          <Link href="/login" className="underline font-medium">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href="/register" className="underline font-medium">
            create an account
          </Link>{" "}
          to save your favorites permanently.
        </AlertDescription>
      </Alert>

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
                    <Link href="/guest/favorites/products">View More</Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {products.map((product) => (
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
                    <Link href="/guest/favorites/stores">View More</Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {stores.map((store) => (
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
