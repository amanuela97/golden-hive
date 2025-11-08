import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-background">
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
              <Link href="/en">Go to Homepage</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/en/products">Browse Products</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
