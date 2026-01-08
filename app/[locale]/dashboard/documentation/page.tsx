import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import AdminDocumentationContent from "../components/shared/AdminDocumentationContent";
import SellerDocumentationContent from "../components/shared/SellerDocumentationContent";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import DashboardNotFound from "../not-found";

export default async function DocumentationPage() {
  // Automatically checks route access based on navigation config
  const result = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName, userId } = result;

  // Render different content based on role
  return (
    <DashboardWrapper userRole={roleName}>
      {roleName === "admin" ? (
        <AdminDocumentationContent />
      ) : (
        <SellerDocumentationContent sellerId={userId} />
      )}
    </DashboardWrapper>
  );
}
