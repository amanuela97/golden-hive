import { getTrendingProductsData } from "@/app/[locale]/actions/homepage";
import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { getLocale } from "next-intl/server";

export async function TrendingProducts() {
  const locale = await getLocale();
  const products = await getTrendingProductsData({ limit: 4, locale });

  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-end justify-between animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Trending Now
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Discover what&apos;s popular with our community
            </p>
          </div>
          <Button
            variant="ghost"
            asChild
            className="hover:shadow-md transition-all"
          >
            <Link href="/products?sort=trending">
              {products.length >= 4 ? "View All" : ""}
            </Link>
          </Button>
        </div>
        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-1000">
            {products.map((product, idx) => (
              <div
                key={product.id}
                className="relative animate-in fade-in slide-in-from-bottom-4"
                style={{
                  animationDelay: `${idx * 100}ms`,
                  animationFillMode: "both",
                }}
              >
                {product.isFeatured && (
                  <Badge className="absolute top-3 left-3 z-10 bg-accent shadow-lg animate-in zoom-in-50 duration-500">
                    Featured
                  </Badge>
                )}
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No trending products available at the moment.
          </div>
        )}
      </div>
    </section>
  );
}
