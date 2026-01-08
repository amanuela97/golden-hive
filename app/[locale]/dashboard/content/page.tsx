import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import ContentManagementIndex from "./ContentManagementIndex";

export default async function ContentPage() {
  const { role } = await protectDashboardRoute({
    allowedRoles: ["admin"],
  });

  return (
    <DashboardWrapper userRole={role}>
      <ContentManagementIndex />
    </DashboardWrapper>
  );
}
