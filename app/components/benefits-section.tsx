import {
  BenefitItem,
  BenefitsSection as BenefitsSectionType,
} from "@/app/actions/homepage-content";
import { ICON_MAP } from "@/lib/icons";
import { Leaf } from "lucide-react";

interface BenefitsSectionProps {
  data: BenefitsSectionType;
}

export function BenefitsSection({ data }: BenefitsSectionProps) {
  if (!data.isActive) return null;

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-foreground">
          {data.title}
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {data.items.slice(0, 3).map((benefit: BenefitItem, index: number) => {
            const Icon =
              ICON_MAP[benefit.icon as keyof typeof ICON_MAP] || Leaf;

            return (
              <div
                key={index}
                className="bg-card p-8 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-foreground">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
