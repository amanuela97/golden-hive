import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import MarketFormClient from "./MarketFormClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import DashboardNotFound from "../../not-found";

export default async function NewMarketPage() {
  // Automatically checks route access based on navigation config
  const { role: roleName, shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/markets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Market</h1>
            <p className="text-muted-foreground mt-2">
              Create a new market with currency and countries
            </p>
          </div>
        </div>
        <MarketFormClient />
      </div>
    </DashboardWrapper>
  );
}
