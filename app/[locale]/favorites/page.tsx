import { getFavorites } from "@/app/[locale]/actions/favorites";
import { FavoritesClient } from "./FavoritesClient";

export default async function FavoritesPage() {
  const favorites = await getFavorites("en");

  return (
    <div className="container mx-auto px-4 py-8">
      <FavoritesClient
        initialProducts={favorites.listings || []}
        initialStores={favorites.stores || []}
      />
    </div>
  );
}

