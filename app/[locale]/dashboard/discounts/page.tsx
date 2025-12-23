import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../components/shared/DashboardWrapper";
import { getUserRole } from "@/lib/user-role";
import DiscountsPageClient from "./DiscountsPageClient";
import { getDiscounts } from "../../actions/discounts";

export default async function DiscountsPage() {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  const { roleName, error: roleError } = await getUserRole(
    session?.user?.id ?? ""
  );

  if (roleError || !roleName) {
    redirect({ href: "/onboarding", locale });
  }

  const roleNameTyped = roleName as "admin" | "seller" | "customer";

  // Only admin and seller can access discounts
  if (roleNameTyped !== "admin" && roleNameTyped !== "seller") {
    redirect({ href: "/dashboard", locale });
  }

  const isAdmin = roleNameTyped === "admin";

  // Fetch discounts
  const discountsResult = await getDiscounts();
  const discounts = discountsResult.success ? discountsResult.discounts || [] : [];

  return (
    <DashboardWrapper userRole={roleNameTyped}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discounts</h1>
            <p className="text-muted-foreground mt-2">
              {isAdmin
                ? "Manage all discounts across the platform"
                : "Manage your discounts and promotions"}
            </p>
          </div>
        </div>

        <DiscountsPageClient
          discounts={discounts}
          isAdmin={isAdmin}
        />
      </div>
    </DashboardWrapper>
  );
}

