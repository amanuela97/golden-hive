import AboutManager from "../AboutManager";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export const dynamic = "force-dynamic";

export default async function HomepageAboutContentPage() {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">
            Manage Homepage About Section
          </h1>
          <AboutManager />
        </div>
      </div>
    </div>
  );
}
