import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import { getOrderWithItems } from "@/app/[locale]/actions/orders";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import OrderDetailsPageClient from "./OrderDetailsPageClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import DashboardNotFound from "../../not-found";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  // Automatically checks route access based on navigation config
  const { role: roleName, shouldShowNotFound } = await protectDashboardRoute({
    allowedRoles: ["admin", "seller", "customer"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { id } = await params;

  // Validate order ID format
  if (!id || typeof id !== "string" || id.length !== 36) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Order Not Found</h2>
                <p className="text-muted-foreground">
                  The order ID is invalid or incorrect. Please check the order
                  ID and try again.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  const result = await getOrderWithItems(id);

  if (!result.success || !result.data) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Order Not Found</h2>
                <p className="text-muted-foreground">
                  {result.error ||
                    "The order does not exist or you don&apos;t have permission to view it."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  // Keep orderNumber as string (it's stored as text in database)
  const orderData = result.data;

  if (!orderData) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">Order Not Found</h2>
                <p className="text-muted-foreground">
                  The order does not exist or you don&apos;t have permission to
                  view it.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <OrderDetailsPageClient orderData={orderData} userRole={roleName} />
    </DashboardWrapper>
  );
}
