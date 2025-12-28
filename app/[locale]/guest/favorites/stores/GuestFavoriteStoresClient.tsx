"use client";

import { useState, useEffect } from "react";
import { getGuestFavorites } from "@/lib/guest-favorites";
import { listPublicStores } from "@/app/[locale]/actions/storefront";
import { StoreCard } from "@/app/[locale]/stores/components/StoreCard";

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

export function GuestFavoriteStoresClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStores() {
      const favorites = getGuestFavorites();

      if (favorites.stores.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const storeIds = favorites.stores.map((f) => f.id);
        const storesResult = await listPublicStores({ limit: 1000 });
        const filteredStores = storesResult.filter((s: Store) =>
          storeIds.includes(s.id)
        );
        setStores(filteredStores || []);
      } catch (error) {
        console.error("Error loading favorite stores:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStores();
  }, []);

  if (loading) {
    return <div>Loading favorite stores...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Favorite Stores</h1>
        <p className="text-muted-foreground">
          All stores you&apos;re following
        </p>
      </div>

      {stores.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            You&apos;re not following any stores yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}
