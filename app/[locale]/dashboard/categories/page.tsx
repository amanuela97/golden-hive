import { getAllCategoryRules } from "../../actions/category-rules";
import CategoryManagement from "../components/admin/CategoryManagement";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../not-found";

export default async function CategoriesPage() {
  // Automatically checks route access based on navigation config
  // Categories is admin-only (from settings config)
  const { role: roleName, shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const categoryRulesResult = await getAllCategoryRules();
  const initialCategoryRules = categoryRulesResult.success
    ? categoryRulesResult.result || null
    : null;

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CategoryManagement initialCategoryRules={initialCategoryRules} />
        </div>
      </div>
    </DashboardWrapper>
  );
}
