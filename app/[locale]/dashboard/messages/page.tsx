import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import MessagesPageClient from "./MessagesPageClient";

export default async function MessagesPage() {
  const { role } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller", "customer"],
  });

  return (
    <DashboardWrapper userRole={role}>
      <MessagesPageClient />
    </DashboardWrapper>
  );
}
