import { GuestFavoriteProductsClient } from "./GuestFavoriteProductsClient";

export const dynamic = "force-dynamic";

export default function GuestFavoriteProductsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <GuestFavoriteProductsClient />
    </div>
  );
}

