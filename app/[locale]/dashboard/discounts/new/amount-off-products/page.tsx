import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../../../components/shared/DashboardWrapper";
import { getUserRole } from "@/lib/user-role";
import DiscountFormClient from "./DiscountFormClient";

export default async function NewDiscountPage() {
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

  return (
    <DashboardWrapper userRole={roleNameTyped}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create discount</h1>
          <p className="text-muted-foreground mt-2">Amount off products</p>
        </div>

        <DiscountFormClient userRole={roleNameTyped} />
      </div>
    </DashboardWrapper>
  );
}

