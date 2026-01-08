import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Home } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="space-y-4">
          <h1 className="text-7xl font-bold text-foreground">Oops!</h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-lg">
            Sorry, the page you were looking for was not found.
          </p>
        </div>
        <div className="pt-4">
          <Button asChild size="lg" className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Go back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
