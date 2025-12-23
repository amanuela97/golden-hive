import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import { getUserRole } from "@/lib/user-role";
import { getDiscountById } from "../../../actions/discounts";
import EditDiscountFormClient from "./EditDiscountFormClient";
import { notFound } from "next/navigation";

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;

  // Fetch discount
  const discountResult = await getDiscountById(id);

  if (!discountResult.success || !discountResult.data) {
    notFound();
  }

  // Check if discount has been used
  const hasBeenUsed = discountResult.data.usageCount > 0;

  // Get store name if it's a seller discount (for UI display)
  let storeName: string | null = null;
  if (
    discountResult.data.ownerType === "seller" &&
    discountResult.data.ownerId
  ) {
    const { db } = await import("@/db");
    const { store } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const storeData = await db
      .select({ storeName: store.storeName })
      .from(store)
      .where(eq(store.id, discountResult.data.ownerId))
      .limit(1);
    if (storeData.length > 0) {
      storeName = storeData[0].storeName;
    }
  }

  // Transform data to match EditDiscountFormClient expectations
  const discountData = discountResult.data;
  const now = new Date();

  // Compute status
  let status: "active" | "scheduled" | "expired" | "disabled";
  if (!discountData.isActive) {
    status = "disabled";
  } else if (discountData.startsAt && discountData.startsAt > now) {
    status = "scheduled";
  } else if (discountData.endsAt && discountData.endsAt < now) {
    status = "expired";
  } else {
    status = "active";
  }

  // Compute appliesTo
  const productCount =
    discountData.targets.type === "listing_ids"
      ? discountData.targets.listingIds.length
      : -1;
  const appliesTo =
    productCount === -1
      ? "All products"
      : productCount
        ? `${productCount} products`
        : "No products";

  // Compute usage
  const usage = discountData.usageLimit
    ? `${discountData.usageCount} / ${discountData.usageLimit}`
    : `${discountData.usageCount} / ∞`;

  // Compute activeDates
  let activeDates = "—";
  if (discountData.startsAt || discountData.endsAt) {
    const start = discountData.startsAt
      ? discountData.startsAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    const end = discountData.endsAt
      ? discountData.endsAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    if (start && end) {
      activeDates = `${start} – ${end}`;
    } else if (start) {
      activeDates = `From ${start}`;
    } else if (end) {
      activeDates = `Until ${end}`;
    }
  }

  const transformedDiscount = {
    id: discountData.id,
    name: discountData.name,
    code: discountData.code,
    type: discountData.type,
    valueType: discountData.valueType,
    value: discountData.value.toString(),
    currency: discountData.currency,
    appliesOncePerOrder: false, // Not used in new schema
    usageLimit: discountData.usageLimit,
    usageCount: discountData.usageCount,
    minPurchaseAmount:
      discountData.minimumRequirement.type === "amount"
        ? discountData.minimumRequirement.amount.toString()
        : null,
    minPurchaseQuantity:
      discountData.minimumRequirement.type === "quantity"
        ? discountData.minimumRequirement.quantity
        : null,
    customerEligibilityType:
      discountData.eligibility.type === "specific" ? "specific" : "all",
    startsAt: discountData.startsAt,
    endsAt: discountData.endsAt,
    isActive: discountData.isActive,
    createdAt: discountData.startsAt || new Date(), // Fallback if not available
    updatedAt: new Date(), // Current time as fallback
    status,
    appliesTo,
    usage,
    activeDates,
    productIds:
      discountData.targets.type === "listing_ids"
        ? discountData.targets.listingIds
        : undefined,
    customerIds:
      discountData.eligibility.type === "specific"
        ? discountData.eligibility.customerIds
        : undefined,
    productCount:
      discountData.targets.type === "listing_ids"
        ? discountData.targets.listingIds.length
        : undefined,
  };

  return (
    <DashboardWrapper userRole={roleNameTyped}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit discount</h1>
          <p className="text-muted-foreground mt-2">Amount off products</p>
        </div>

        <EditDiscountFormClient
          discount={transformedDiscount}
          hasBeenUsed={hasBeenUsed}
          userRole={roleNameTyped}
          discountOwnerType={discountData.ownerType}
          discountOwnerStoreName={storeName}
          discountOwnerId={discountData.ownerId || null}
        />
      </div>
    </DashboardWrapper>
  );
}
