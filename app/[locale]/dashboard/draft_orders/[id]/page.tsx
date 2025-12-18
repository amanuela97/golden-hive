import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import { getDraftOrder } from "@/app/[locale]/actions/draft-orders";
import DraftOrderPageClient from "./DraftOrderPageClient";

interface DraftOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function DraftOrderPage({ params }: DraftOrderPageProps) {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  const { id: draftId } = await params;

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

  // Only admin and seller can access drafts
  if (roleName === "customer") {
    redirect({ href: "/dashboard", locale });
  }

  // Fetch draft order
  const draftResult = await getDraftOrder(draftId);

  if (!draftResult.success || !draftResult.data) {
    return (
      <DashboardWrapper userRole={roleName}>
        <div className="p-6">
          <div className="text-red-600">
            {draftResult.error || "Draft order not found"}
          </div>
        </div>
      </DashboardWrapper>
    );
  }

  const draftData = draftResult.data;

  // Transform draft order data to CreateOrderForm initialData format
  const initialData = {
    customerId: draftData.customerId,
    customerEmail: draftData.customerEmail || "",
    customerFirstName: draftData.customerFirstName,
    customerLastName: draftData.customerLastName,
    customerPhone: draftData.customerPhone,
    lineItems: draftData.items.map((item) => {
      // Parse title to extract listing name and variant title
      const titleParts = item.title.split(" - ");
      const listingName = titleParts[0] || item.title;
      const variantTitle = titleParts.length > 1 ? titleParts.slice(1).join(" - ") : item.title;
      
      return {
        id: item.id,
        listingId: item.listingId || "",
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        title: item.title,
        sku: item.sku,
        listingName,
        variantTitle,
        imageUrl: item.imageUrl,
        variantImageUrl: item.imageUrl,
        currency: draftData.currency,
        originalCurrency: draftData.currency,
        originalUnitPrice: item.unitPrice,
        available: 999, // We'll need to fetch this, but for now use a high number
      };
    }),
    currency: draftData.currency,
    shippingName: draftData.shippingName,
    shippingPhone: draftData.shippingPhone,
    shippingAddressLine1: draftData.shippingAddressLine1,
    shippingAddressLine2: draftData.shippingAddressLine2,
    shippingCity: draftData.shippingCity,
    shippingRegion: draftData.shippingRegion,
    shippingPostalCode: draftData.shippingPostalCode,
    shippingCountry: draftData.shippingCountry,
    billingName: draftData.billingName,
    billingPhone: draftData.billingPhone,
    billingAddressLine1: draftData.billingAddressLine1,
    billingAddressLine2: draftData.billingAddressLine2,
    billingCity: draftData.billingCity,
    billingRegion: draftData.billingRegion,
    billingPostalCode: draftData.billingPostalCode,
    billingCountry: draftData.billingCountry,
    paymentStatus: draftData.paymentStatus,
    marketId: draftData.marketId,
  };

  return (
    <DashboardWrapper userRole={roleName}>
      <DraftOrderPageClient
        draftId={draftId}
        draftNumber={draftData.draftNumber}
        customerEmail={draftData.customerEmail}
        userRole={roleName}
        initialData={initialData}
      />
    </DashboardWrapper>
  );
}

