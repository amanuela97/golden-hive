import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getOrderWithItems } from "@/app/[locale]/actions/orders";
import { DashboardWrapper } from "@/app/[locale]/dashboard/components/shared/DashboardWrapper";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import RefundPageClient from "./RefundPageClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

interface RefundPageProps {
  params: Promise<{ id: string }>;
}

export default async function RefundPage({ params }: RefundPageProps) {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Get user's role
  const userRole = await db
    .select({
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session?.user.id ?? ""))
    .limit(1);

  if (userRole.length === 0) {
    redirect({ href: "/onboarding", locale });
  }

  const roleName = userRole[0].roleName.toLowerCase() as
    | "admin"
    | "seller"
    | "customer";

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
                    "The order does not exist or you don't have permission to view it."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardWrapper>
    );
  }

  // Check if order can be refunded
  // Note: Fulfilled orders CAN be refunded (refunding doesn't un-fulfill)
  const order = result.data;
  const isPaid =
    order.paymentStatus === "paid" ||
    order.paymentStatus === "partially_refunded";
  const isArchived = order.archivedAt !== null || order.status === "archived";
  const isCanceled = order.status === "canceled";
  const canRefund =
    (roleName === "admin" || roleName === "seller") &&
    isPaid &&
    !isArchived &&
    !isCanceled;
  // Note: Fulfilled orders are allowed to be refunded

  if (!canRefund) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="space-y-6">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/orders/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Order
            </Link>
          </Button>
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground" />
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Cannot Refund Order
                </h2>
                <p className="text-muted-foreground">
                  This order cannot be refunded. It may not be paid, or it may
                  be archived or canceled.
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

  return (
    <DashboardWrapper userRole={roleName}>
      <RefundPageClient orderData={orderData} />
    </DashboardWrapper>
  );
}
