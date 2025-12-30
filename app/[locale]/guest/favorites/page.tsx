import { GuestFavoritesClient } from "./GuestFavoritesClient";

export const dynamic = "force-dynamic";

export default function GuestFavoritesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <GuestFavoritesClient />
    </div>
  );
}

