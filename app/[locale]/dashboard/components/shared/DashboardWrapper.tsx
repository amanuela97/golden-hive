"use client";

import { DashboardLayout } from "./DashboardLayout";
import { DashboardHome } from "./DashboardHome";

interface DashboardWrapperProps {
  children: React.ReactNode;
  userRole: "admin" | "seller" | "customer";
  showHome?: boolean;
  stats?: {
    totalProducts?: number;
    totalUsers?: number;
    totalOrders?: number;
    revenue?: number;
  };
}

export function DashboardWrapper({
  children,
  userRole,
  showHome = false,
  stats,
}: DashboardWrapperProps) {
  return (
    <DashboardLayout userRole={userRole}>
      {showHome ? (
        <DashboardHome userRole={userRole} stats={stats} />
      ) : (
        children
      )}
    </DashboardLayout>
  );
}
