import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import DashboardNotFound from "../../not-found";
import { EsewaPayoutsClient } from "./EsewaPayoutsClient";

export default async function EsewaPayoutsPage() {
  const result = await protectDashboardRoute({
    allowedRoles: ["admin"],
    showNotFound: true,
  });

  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  return (
    <DashboardWrapper userRole={result.role}>
      <EsewaPayoutsClient />
    </DashboardWrapper>
  );
}
