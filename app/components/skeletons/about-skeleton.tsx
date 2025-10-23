export function AboutSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text Content Skeleton */}
          <div className="space-y-6 animate-pulse">
            {/* Title skeleton */}
            <div className="space-y-3">
              <div className="h-10 md:h-12 bg-muted rounded-lg w-3/4" />
              <div className="h-10 md:h-12 bg-muted rounded-lg w-2/3" />
            </div>

            {/* Content skeleton */}
            <div className="space-y-3 pt-4">
              <div className="h-5 bg-muted/70 rounded-lg w-full" />
              <div className="h-5 bg-muted/70 rounded-lg w-full" />
              <div className="h-5 bg-muted/70 rounded-lg w-5/6" />
              <div className="h-5 bg-muted/70 rounded-lg w-full" />
              <div className="h-5 bg-muted/70 rounded-lg w-4/5" />
            </div>
          </div>

          {/* Image Skeleton */}
          <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden bg-muted animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />
          </div>
        </div>
      </div>
    </section>
  );
}
