export function HeroSkeleton() {
  return (
    <section className="relative h-[600px] overflow-hidden bg-muted">
      <div className="absolute inset-0 animate-pulse">
        {/* Background skeleton */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />

        {/* Content overlay skeleton */}
        <div className="relative h-full flex items-center justify-center">
          <div className="container mx-auto px-4 text-center space-y-6">
            {/* Title skeleton */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 md:h-16 lg:h-20 bg-muted-foreground/20 rounded-lg w-3/4 max-w-3xl" />
              <div className="h-12 md:h-16 lg:h-20 bg-muted-foreground/20 rounded-lg w-2/3 max-w-2xl" />
            </div>

            {/* Subtitle skeleton */}
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="h-6 md:h-8 bg-muted-foreground/15 rounded-lg w-2/3 max-w-2xl" />
              <div className="h-6 md:h-8 bg-muted-foreground/15 rounded-lg w-1/2 max-w-xl" />
            </div>

            {/* Button skeleton */}
            <div className="h-12 bg-muted-foreground/20 rounded-lg w-32 mx-auto mt-8" />
          </div>
        </div>

        {/* Slide indicators skeleton */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-8 h-3 rounded-full bg-muted-foreground/30" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
          <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    </section>
  );
}
