export function BenefitsSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Title skeleton */}
        <div className="flex justify-center mb-12 animate-pulse">
          <div className="h-10 md:h-12 bg-muted rounded-lg w-1/2 max-w-md" />
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="bg-card p-8 rounded-lg shadow-sm animate-pulse"
            >
              {/* Icon skeleton */}
              <div className="w-14 h-14 rounded-full bg-muted mb-6" />

              {/* Title skeleton */}
              <div className="space-y-2 mb-4">
                <div className="h-7 bg-muted rounded-lg w-3/4" />
              </div>

              {/* Description skeleton */}
              <div className="space-y-2">
                <div className="h-4 bg-muted/70 rounded-lg w-full" />
                <div className="h-4 bg-muted/70 rounded-lg w-full" />
                <div className="h-4 bg-muted/70 rounded-lg w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
