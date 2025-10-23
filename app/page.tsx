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
  title: "Premium Himalayan Mad Honey | Pure & Natural Honey Store",
  description:
    "Discover the finest Himalayan mad honey, traditionally harvested from pristine mountain cliffs. 100% organic, pure, and natural honey with unique health benefits.",
  keywords: [
    "mad honey",
    "himalayan honey",
    "organic honey",
    "natural honey",
    "pure honey",
    "rhododendron honey",
  ],
  openGraph: {
    title: "Premium Himalayan Mad Honey | Pure & Natural",
    description:
      "Traditionally harvested mad honey from the Himalayas. Pure, organic, and supporting local communities.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export const revalidate = 3600; // revalidate every 1 hour

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
