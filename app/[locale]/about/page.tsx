import type { Metadata } from "next";
import { getAboutData } from "../actions/site-content";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { ICON_MAP } from "@/lib/icons";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "About Us",
  description: "Discover our mission & what sets us apart",
  openGraph: {
    title: "About Us",
    description: "Discover our mission & what sets us apart",
  },
};

// ISR via on-demand revalidation (no automatic interval)
export const revalidate = false;

export default async function AboutPage() {
  const locale = await getLocale();
  const data = await getAboutData(locale);
  const sections = data?.sections ?? [];
  const byType = (t: string) => sections.find((s) => s.type === t);
  const valuesExtra =
    (byType("values")?.extraData as Record<string, string> | null) ?? {};
  const processExtra =
    (byType("process")?.extraData as Record<string, string> | null) ?? {};
  const benefitsExtra =
    (byType("benefits")?.extraData as Record<string, string> | null) ?? {};
  const ctaExtra =
    (byType("cta")?.extraData as Record<string, string> | null) ?? {};
  const ValuesCard1Icon =
    ICON_MAP[valuesExtra.card1Icon as keyof typeof ICON_MAP] || CheckCircle2;
  const ValuesCard2Icon =
    ICON_MAP[valuesExtra.card2Icon as keyof typeof ICON_MAP] || CheckCircle2;
  const ValuesCard3Icon =
    ICON_MAP[valuesExtra.card3Icon as keyof typeof ICON_MAP] || CheckCircle2;

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      {byType("hero")?.isVisible && (
        <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden">
          <Image
            src={byType("hero")?.imageUrl || "/rhododendr.png"}
            alt={
              byType("hero")?.title ||
              "Himalayan mountains where mad honey is harvested"
            }
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
          <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-balance">
              {byType("hero")?.title || "Our Story"}
            </h1>
            <p className="text-lg md:text-xl text-balance leading-relaxed">
              {byType("hero")?.subtitle ||
                "Bringing the ancient tradition of Himalayan mad honey to the world"}
            </p>
          </div>
        </section>
      )}

      {/* Mission Section */}
      {byType("mission")?.isVisible && (
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {byType("mission")?.title || "Our Mission"}
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  {(byType("mission")?.content || "")
                    .split("\n")
                    .filter(Boolean)
                    .map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                </div>
              </div>
              <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden">
                <Image
                  src={
                    byType("mission")?.imageUrl ||
                    "/traditional-honey-hunter-in-himalayas-collecting-m.jpg"
                  }
                  alt={
                    byType("mission")?.subtitle ||
                    "Traditional honey hunter collecting mad honey"
                  }
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Values Section */}
      {byType("values")?.isVisible && (
        <section className="py-16 md:py-24 px-4 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {byType("values")?.title || "What Sets Us Apart"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {byType("values")?.subtitle ||
                  "Our commitment to excellence and authenticity in every aspect of our business"}
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-8 rounded-lg border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <ValuesCard1Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {valuesExtra.card1Title || "100% Authentic"}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {valuesExtra.card1Text ||
                    "Sourced directly from the Himalayan foothills at altitudes of 8,200 to 11,500 feet. Every batch is tested and verified for authenticity and purity."}
                </p>
              </div>
              <div className="bg-card p-8 rounded-lg border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <ValuesCard2Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {valuesExtra.card2Title || "Sustainably Harvested"}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {valuesExtra.card2Text ||
                    "We work with local communities using traditional, sustainable methods that protect the environment and preserve this ancient practice for future generations."}
                </p>
              </div>
              <div className="bg-card p-8 rounded-lg border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <ValuesCard3Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {valuesExtra.card3Title || "Quality Guaranteed"}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {valuesExtra.card3Text ||
                    "Each jar undergoes rigorous quality control. We guarantee 100% organic, raw, and unprocessed mad honey with no additives or external particles."}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Process Section */}
      {byType("process")?.isVisible && (
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden order-2 md:order-1">
                <Image
                  src={
                    byType("process")?.imageUrl ||
                    "/rhododendron-flowers-in-himalayan-mountains-with-b.jpg"
                  }
                  alt={
                    byType("process")?.subtitle ||
                    "Rhododendron flowers in the Himalayas"
                  }
                  fill
                  className="object-cover"
                />
              </div>
              <div className="space-y-6 order-1 md:order-2">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {byType("process")?.title || "The Harvesting Process"}
                </h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {processExtra.step1Title || "Wild Collection"}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {processExtra.step1Text ||
                          "Bees collect nectar from wild rhododendron flowers blooming at high altitudes in the spring season."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {processExtra.step2Title || "Traditional Harvesting"}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {processExtra.step2Text ||
                          "Expert honey hunters use ancient techniques passed down through generations to safely harvest from cliff-side hives."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {processExtra.step3Title || "Minimal Processing"}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {processExtra.step3Text ||
                          "The honey undergoes minimal processing to maintain its natural properties, with only light filtration to remove debris."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {processExtra.step4Title || "Quality Testing"}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {processExtra.step4Text ||
                          "Every batch is tested for purity and authenticity before being carefully packaged and shipped to you."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Benefits Section */}
      {byType("benefits")?.isVisible && (
        <section className="py-16 md:py-24 px-4 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {byType("benefits")?.title || "Why Mad Honey?"}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {byType("benefits")?.subtitle ||
                  "Revered for centuries for its unique properties and traditional uses"}
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b1Title || "Natural Energy"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b1Text ||
                    "Known for providing a natural boost of energy and vitality throughout the day."}
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b2Title || "Stress Relief"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b2Text ||
                    "Traditionally used to promote relaxation and reduce feelings of stress and anxiety."}
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b3Title || "Digestive Support"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b3Text ||
                    "May help support healthy digestion and soothe digestive discomfort."}
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b4Title || "Immune Boost"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b4Text ||
                    "Rich in antioxidants that may help support a healthy immune system."}
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b5Title || "Traditional Medicine"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b5Text ||
                    "Used for centuries in traditional medicine for various health benefits."}
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">
                  {benefitsExtra.b6Title || "100% Organic"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefitsExtra.b6Text ||
                    "Completely natural with no additives, preservatives, or artificial ingredients."}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
      {/* CTA Section */}
      {byType("cta")?.isVisible && (
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {byType("cta")?.title ||
                "Experience Authentic Himalayan Mad Honey"}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {byType("cta")?.subtitle ||
                "Join thousands of satisfied customers who have discovered the unique benefits of our premium mad honey. Every purchase supports local communities and sustainable harvesting practices."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-base">
                <Link href={ctaExtra.primaryHref || "/products"}>
                  {ctaExtra.primaryText || "Shop Now"}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-base bg-transparent"
              >
                <Link href={ctaExtra.secondaryHref || "/feedback"}>
                  {ctaExtra.secondaryText || "Leave a Feedback"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
