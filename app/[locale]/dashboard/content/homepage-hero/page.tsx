import HomepageHeroManager from "../HomepageHeroManager";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export const dynamic = "force-dynamic";

export default async function HomepageHeroPage() {
  // Automatically checks route access based on navigation config
  // Content pages are admin-only (from settings config)
  const result = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  return <HomepageHeroManager />;
}
