import { redirect } from "@/i18n/navigation";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import { getMarketById } from "@/app/[locale]/actions/markets-management";
import MarketFormClient from "./MarketFormClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export default async function EditMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Automatically checks route access based on navigation config
  const {
    role: roleName,
    locale,
    shouldShowNotFound,
  } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { id } = await params;
  const result = await getMarketById(id);

  if (!result.success || !result.data) {
    redirect({ href: "/dashboard/markets", locale });
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
            <h1 className="text-3xl font-bold">Edit Market</h1>
            <p className="text-muted-foreground mt-2">
              Update market information
            </p>
          </div>
        </div>
        <MarketFormClient initialData={result.data!} marketId={id} />
      </div>
    </DashboardWrapper>
  );
}
