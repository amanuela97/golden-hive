import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import MessagesPageClient from "./MessagesPageClient";

/**
 * Single route for /dashboard/messages and /dashboard/messages?roomId=xxx.
 * Room id in URL is via query param so the same page (and client) stays mounted - no list flash on desktop.
 */
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
