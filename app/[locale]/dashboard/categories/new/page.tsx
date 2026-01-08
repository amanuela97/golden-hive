import NewCategoryForm from "./NewCategoryForm";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

export default async function AdminNewCategoryPage() {
  // Automatically checks route access based on navigation config
  // Categories is admin-only (from settings config)
  const { shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Category Rule
          </h1>
          <p className="text-gray-600 mt-2">
            Set documentation requirements for a taxonomy category
          </p>
        </div>
        <NewCategoryForm />
      </div>
    </div>
  );
}
