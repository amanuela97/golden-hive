import { getFavoriteListings } from "@/app/[locale]/actions/favorites";
import { FavoriteProductsClient } from "./FavoriteProductsClient";

export default async function FavoriteProductsPage() {
  const result = await getFavoriteListings("en");

  return (
    <div className="container mx-auto px-4 py-8">
      <FavoriteProductsClient initialProducts={result.result || []} />
    </div>
  );
}

