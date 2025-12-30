import { GuestFavoriteStoresClient } from "./GuestFavoriteStoresClient";

export const dynamic = "force-dynamic";

export default function GuestFavoriteStoresPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <GuestFavoriteStoresClient />
    </div>
  );
}

