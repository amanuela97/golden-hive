import { getFeaturedStores } from "@/app/[locale]/actions/homepage";
import { StoreCard } from "../stores/components/StoreCard";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function FeaturedStores() {
  let stores: Awaited<ReturnType<typeof getFeaturedStores>> = [];

  try {
    stores = await getFeaturedStores({ limit: 4 });
  } catch (error) {
    console.error("Error loading featured stores:", error);
    // Error is already handled in getFeaturedStores, but add extra safety
    stores = [];
  }

  return (
    <section className="py-12 md:py-16 bg-card">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-end justify-between animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Featured Vendors
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Meet the artisans behind the products
            </p>
          </div>
          {stores.length >= 4 && (
            <Button
              variant="ghost"
              asChild
              className="hover:shadow-md transition-all"
            >
              <Link href="/stores?sort=newest">View More</Link>
            </Button>
          )}
        </div>
        {stores.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-1000">
            {stores.map((store, idx) => (
              <div
                key={store.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{
                  animationDelay: `${idx * 100}ms`,
                  animationFillMode: "both",
                }}
              >
                <StoreCard
                  store={{
                    id: store.id,
                    storeName: store.storeName,
                    slug: store.slug,
                    logoUrl: store.logoUrl,
                    ratingAvg: store.ratingAvg,
                    ratingCount: store.ratingCount,
                    followerCount: store.followerCount,
                    bannerUrl: store.bannerUrl || undefined,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No featured stores available at the moment.
          </div>
        )}
      </div>
    </section>
  );
}
