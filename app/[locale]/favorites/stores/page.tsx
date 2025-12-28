import { getFollowedStores } from "@/app/[locale]/actions/favorites";
import { FavoriteStoresClient } from "./FavoriteStoresClient";

export default async function FavoriteStoresPage() {
  const result = await getFollowedStores();

  return (
    <div className="container mx-auto px-4 py-8">
      <FavoriteStoresClient initialStores={result.result || []} />
    </div>
  );
}

