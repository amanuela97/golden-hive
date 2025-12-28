import { getNewArrivals } from "@/app/[locale]/actions/homepage";
import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { getLocale } from "next-intl/server";

export async function NewArrivals() {
  const locale = await getLocale();
  const products = await getNewArrivals({ limit: 4, locale });

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              New Arrivals
            </h2>
            <Badge
              variant="secondary"
              className="text-xs bg-gradient-to-r from-blue-500 via-sky-400 to-yellow-500 bg-clip-text text-transparent animate-gradient animate-glow-pulsate font-semibold px-3 py-1"
            >
              Fresh This Week
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Discover the latest additions from our talented vendors
          </p>
        </div>
        {products.length > 0 ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-1000">
              {products.map((product, idx) => (
                <div
                  key={product.id}
                  className="animate-in fade-in slide-in-from-bottom-4"
                  style={{
                    animationDelay: `${idx * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            {products.length >= 4 && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  asChild
                  className="hover:shadow-md transition-all"
                >
                  <Link href="/products?sort=newest">View More</Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No new products available at the moment.
          </div>
        )}
      </div>
    </section>
  );
}
