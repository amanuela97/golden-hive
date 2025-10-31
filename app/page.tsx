import { HeroSection } from "@/app/components/hero-section";
import { AboutSection } from "@/app/components/about-section";
import { BenefitsSection } from "@/app/components/benefits-section";
import {
  getPublicHeroSlides,
  getPublicAboutSection,
  getPublicBenefitsSection,
} from "@/app/actions/homepage-content";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroSkeleton } from "./components/skeletons/hero-skeleton";
import { AboutSkeleton } from "./components/skeletons/about-skeleton";
import { BenefitsSkeleton } from "./components/skeletons/benefits-skeleton";

export const metadata: Metadata = {
  title: "Connecting entrepreneurs with customers",
  description:
    "Discover the finest products from entrepreneurs around the world",
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
    title: "Connecting entrepreneurs with customers",
    description:
      "Discover the finest products from entrepreneurs around the world",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export const revalidate = false; // means static by default, updated only on revalidation

async function HeroLoader() {
  const result = await getPublicHeroSlides();
  return <HeroSection slides={result.success ? result.result || [] : []} />;
}

async function AboutLoader() {
  const result = await getPublicAboutSection();
  return result.success && result.result ? (
    <AboutSection data={result.result} />
  ) : null;
}

async function BenefitsLoader() {
  const result = await getPublicBenefitsSection();
  return result.success && result.result ? (
    <BenefitsSection data={result.result} />
  ) : null;
}

export default async function HomePage() {
  return (
    <main>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroLoader />
      </Suspense>

      <Suspense fallback={<AboutSkeleton />}>
        <AboutLoader />
      </Suspense>

      <Suspense fallback={<BenefitsSkeleton />}>
        <BenefitsLoader />
      </Suspense>
    </main>
  );
}
