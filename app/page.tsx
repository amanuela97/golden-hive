import { HeroSection } from "@/app/components/hero-section";
import { AboutSection } from "@/app/components/about-section";
import { BenefitsSection } from "@/app/components/benefits-section";
import {
  getAllHeroSlides,
  getAboutSection,
  getBenefitsSection,
} from "@/app/actions/homepage-content";
import type { Metadata } from "next";

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

export default async function HomePage() {
  // Fetch all homepage data in parallel
  const [heroResult, aboutResult, benefitsResult] = await Promise.all([
    getAllHeroSlides(),
    getAboutSection(),
    getBenefitsSection(),
  ]);

  // Extract data from results, fallback to empty arrays/objects if failed
  const heroSlides = heroResult.success ? heroResult.result || [] : [];
  const aboutData = aboutResult.success ? aboutResult.result : null;
  const benefitsData = benefitsResult.success ? benefitsResult.result : null;

  return (
    <main>
      <HeroSection slides={heroSlides} />
      {aboutData && <AboutSection data={aboutData} />}
      {benefitsData && <BenefitsSection data={benefitsData} />}
    </main>
  );
}
