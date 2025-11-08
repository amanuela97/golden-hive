import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Server component for not-found page
// This page is rendered when notFound() is called from within the [locale] layout
export default async function NotFound({
  params,
}: {
  params?: Promise<{ locale: string }>;
}) {
  // Handle case where params might be undefined
  let locale = "en";
  try {
    if (params) {
      const resolvedParams = await params;
      locale = resolvedParams?.locale || "en";
    }
  } catch (error) {
    console.error("Error resolving params:", error);
    // If params can't be resolved, use default locale
    locale = "en";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link href={`/${locale}`}>Go to Homepage</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/products`}>Browse Products</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
