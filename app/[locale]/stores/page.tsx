import { listPublicStores } from "../actions/storefront";
import { StoreCard } from "./components/StoreCard";
import { Suspense } from "react";

interface StoresPageProps {
  searchParams: Promise<{ sort?: string; search?: string }>;
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const params = await searchParams;
  const stores = await listPublicStores({
    sortBy: (params.sort as "followers" | "rating" | "newest") || "followers",
    search: params.search,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Stores</h1>
      {/* Search and sort UI can be added here */}
      <Suspense fallback={<div>Loading stores...</div>}>
        {stores.length === 0 ? (
          <p className="text-muted-foreground">No stores found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
      </Suspense>
    </div>
  );
}

