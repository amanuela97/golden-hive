import { HeroSection } from "./components/hero-section";
import { AboutSection } from "./components/about-section";
import { BenefitsSection } from "./components/benefits-section";
import {
  getPublicHeroSlides,
  getPublicAboutSection,
  getPublicBenefitsSection,
} from "./actions/homepage-content";
import { getPublicFaq } from "./actions/faq";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroSkeleton } from "./components/skeletons/hero-skeleton";
import { AboutSkeleton } from "./components/skeletons/about-skeleton";
import { BenefitsSkeleton } from "./components/skeletons/benefits-skeleton";
import { FaqSection } from "./components/faq-section";
import { getTranslations } from "next-intl/server";

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

export const dynamic = "force-dynamic";

export const revalidate = false; // means static by default, updated only on revalidation

import { getLocale } from "next-intl/server";

async function HeroLoader() {
  const locale = await getLocale();
  const result = await getPublicHeroSlides(locale);
  return <HeroSection slides={result.success ? result.result || [] : []} />;
}

async function AboutLoader() {
  const locale = await getLocale();
  const result = await getPublicAboutSection(locale);
  return result.success && result.result ? (
    <AboutSection data={result.result} />
  ) : null;
}

async function BenefitsLoader() {
  const locale = await getLocale();
  const result = await getPublicBenefitsSection(locale);
  return result.success && result.result ? (
    <BenefitsSection data={result.result} />
  ) : null;
}

async function FaqLoader() {
  const locale = await getLocale();
  const result = await getPublicFaq(locale);
  return result.success && result.result ? (
    <FaqSection sections={result.result} />
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

      <Suspense fallback={null}>
        <FaqLoader />
      </Suspense>
    </main>
  );
}
