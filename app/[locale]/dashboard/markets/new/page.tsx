import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import MarketForm from "../components/MarketForm";
import MarketFormClient from "./MarketFormClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewMarketPage() {
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

  // Only admin and seller can create markets
  if (roleName !== "admin" && roleName !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  return (
    <DashboardWrapper userRole={roleName}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/markets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Market</h1>
            <p className="text-muted-foreground mt-2">
              Create a new market with currency and countries
            </p>
          </div>
        </div>
        <MarketFormClient />
      </div>
    </DashboardWrapper>
  );
}

