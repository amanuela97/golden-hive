"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { Package, Users, ShoppingCart, TrendingUp } from "lucide-react";
import { DashboardSetupTodo } from "./DashboardSetupTodo";

interface DashboardHomeProps {
  userRole: "admin" | "seller" | "customer";
  stats?: {
    totalProducts?: number;
    totalUsers?: number;
    totalOrders?: number;
    revenue?: number;
  };
}

export function DashboardHome({ userRole, stats }: DashboardHomeProps) {
  const { data: session } = useSession();
  const userName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Golden Market</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {userName}! Here&apos;s what&apos;s happening with your
          account today.
        </p>
      </div>

      {/* Setup Todo List - Only show for admin and seller */}
      {(userRole === "admin" || userRole === "seller") && <DashboardSetupTodo />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userRole === "admin" && (
          <>
            {stats?.totalUsers !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {(userRole === "admin" || userRole === "seller") && (
          <>
            {stats?.totalProducts !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Products
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalProducts}
                  </div>
                </CardContent>
              </Card>
            )}

            {stats?.totalOrders !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Orders
                  </CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                </CardContent>
              </Card>
            )}

            {stats?.revenue !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.revenue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Use the sidebar navigation to access different sections of your
            dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
