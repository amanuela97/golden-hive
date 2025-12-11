"use client";

import { DashboardWrapper } from "./DashboardWrapper";
import { DashboardHome } from "./DashboardHome";

interface DashboardHomeServerProps {
  userRole: "admin" | "seller" | "customer";
  stats?: {
    totalProducts?: number;
    totalUsers?: number;
    totalOrders?: number;
    revenue?: number;
  };
}

export default function DashboardHomeServer({
  userRole,
  stats,
}: DashboardHomeServerProps) {
  return (
    <DashboardWrapper userRole={userRole} showHome={true} stats={stats}>
      <DashboardHome userRole={userRole} stats={stats} />
    </DashboardWrapper>
  );
}
