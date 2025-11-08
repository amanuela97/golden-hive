import Image from "next/image";
import type { AboutSection as AboutSectionType } from "../actions/homepage-content";

interface AboutSectionProps {
  data: AboutSectionType;
}

export function AboutSection({ data }: AboutSectionProps) {
  if (!data.isActive) return null;

  return (
    <section className="py-16 md:py-24 mx-8 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              {data.title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {data.content}
            </p>
          </div>

          {/* Image */}
          <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden">
            <Image
              src={data.assetUrl || "/placeholder.svg"}
              alt={data.title || "About section image"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
