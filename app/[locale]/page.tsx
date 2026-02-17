import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { NewArrivals } from "./components/new-arrivals";
import { TrendingProducts } from "./components/trending-products";
import { FeaturedStores } from "./components/featured-stores";
import { NewArrivalsSkeleton } from "./components/new-arrivals-skeleton";
import { TrendingProductsSkeleton } from "./components/trending-products-skeleton";
import { FeaturedStoresSkeleton } from "./components/featured-stores-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return {
    title: t("homepage.title"),
    description: t("homepage.description"),
    keywords: [
      "natural products",
      "entrepreneurs",
      "ecommerce",
      "marketplace",
      "business",
      "startup",
      "growth",
      "scaling",
      "entrepreneurship",
      "entrepreneurial",
      "entrepreneurial journey",
    ],
    openGraph: {
      title: t("homepage.title"),
      description: t("homepage.description"),
      type: "website",
    },
  };
}

export default async function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<NewArrivalsSkeleton />}>
        <NewArrivals />
      </Suspense>
      <Suspense fallback={<TrendingProductsSkeleton />}>
        <TrendingProducts />
      </Suspense>
      <Suspense fallback={<FeaturedStoresSkeleton />}>
        <FeaturedStores />
      </Suspense>
    </div>
  );
}
