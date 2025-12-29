"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  Download,
} from "lucide-react";

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  adminUsers: number;
  verifiedUsers: number;
  userGrowth: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  userDistribution: {
    byRole: { role: string; count: number }[];
    byStatus: { status: string; count: number }[];
    byVerification: { verified: boolean; count: number }[];
  };
  activityMetrics: {
    loginsToday: number;
    loginsThisWeek: number;
    loginsThisMonth: number;
    averageSessionTime: string;
  };
}

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [timeRange, setTimeRange] = useState("7d");
  const [loading, setLoading] = useState(true);

  // Mock data - replace with real API calls
  useEffect(() => {
    const mockData: AnalyticsData = {
      totalUsers: 167,
      activeUsers: 142,
      newUsers: 23,
      adminUsers: 3,
      verifiedUsers: 156,
      userGrowth: {
        daily: [5, 8, 12, 7, 15, 9, 11],
        weekly: [45, 52, 38, 67, 71, 58, 63],
        monthly: [120, 135, 142, 158, 167],
      },
      userDistribution: {
        byRole: [
          { role: "Admin", count: 3 },
          { role: "Seller", count: 15 },
          { role: "Customer", count: 149 },
        ],
        byStatus: [
          { status: "Active", count: 142 },
          { status: "Suspended", count: 5 },
          { status: "Pending", count: 20 },
        ],
        byVerification: [
          { verified: true, count: 156 },
          { verified: false, count: 11 },
        ],
      },
      activityMetrics: {
        loginsToday: 89,
        loginsThisWeek: 567,
        loginsThisMonth: 2341,
        averageSessionTime: "12m 34s",
      },
    };

    setAnalyticsData(mockData);
    setLoading(false);
  }, [timeRange]);

  if (loading) {
    return <div className="flex justify-center p-8">Loading analytics...</div>;
  }

  if (!analyticsData) {
    return <div className="text-center p-8">No analytics data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Analytics</h2>
          <p className="text-gray-600">
            Monitor user activity and system metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.totalUsers}
                </p>
                <div className="flex items-center text-sm text-green-600">
                  <TrendingUp className="w-4 h-4 mr-1" />+
                  {analyticsData.newUsers} this month
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Active Users
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.activeUsers}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round(
                    (analyticsData.activeUsers / analyticsData.totalUsers) * 100
                  )}
                  % of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.adminUsers}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round(
                    (analyticsData.adminUsers / analyticsData.totalUsers) * 100
                  )}
                  % of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.verifiedUsers}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round(
                    (analyticsData.verifiedUsers / analyticsData.totalUsers) *
                      100
                  )}
                  % verified
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Suspended</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.userDistribution.byStatus.find(
                    (s) => s.status === "Suspended"
                  )?.count || 0}
                </p>
                <p className="text-sm text-gray-500">Inactive accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Logins Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.activityMetrics.loginsToday}
            </div>
            <p className="text-xs text-gray-600">Active sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Logins This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.activityMetrics.loginsThisWeek}
            </div>
            <p className="text-xs text-gray-600">Total logins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Logins This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.activityMetrics.loginsThisMonth}
            </div>
            <p className="text-xs text-gray-600">Total logins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Session Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.activityMetrics.averageSessionTime}
            </div>
            <p className="text-xs text-gray-600">Per session</p>
          </CardContent>
        </Card>
      </div>

      {/* User Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.userDistribution.byRole.map((item) => (
                <div
                  key={item.role}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm font-medium">{item.role}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(item.count / analyticsData.totalUsers) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Users by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.userDistribution.byStatus.map((item) => (
                <div
                  key={item.status}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm font-medium">{item.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.status === "Active"
                            ? "bg-green-600"
                            : item.status === "Suspended"
                              ? "bg-red-600"
                              : "bg-yellow-600"
                        }`}
                        style={{
                          width: `${(item.count / analyticsData.totalUsers) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.userDistribution.byVerification.map((item) => (
                <div
                  key={item.verified.toString()}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm font-medium">
                    {item.verified ? "Verified" : "Unverified"}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.verified ? "bg-green-600" : "bg-orange-600"
                        }`}
                        style={{
                          width: `${(item.count / analyticsData.totalUsers) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Chart visualization would go here</p>
              <p className="text-sm text-gray-500">
                Integration with charting library needed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
