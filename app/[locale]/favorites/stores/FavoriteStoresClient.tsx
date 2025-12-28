"use client";

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

interface FavoriteStoresClientProps {
  initialStores: Store[];
}

export function FavoriteStoresClient({
  initialStores,
}: FavoriteStoresClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Favorite Stores</h1>
        <p className="text-muted-foreground">
          All stores you&apos;re following
        </p>
      </div>

      {initialStores.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            You&apos;re not following any stores yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {initialStores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}

