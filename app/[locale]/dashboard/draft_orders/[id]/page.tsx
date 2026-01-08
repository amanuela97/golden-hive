import { db } from "@/db";
import { orderEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DashboardWrapper } from "../../components/shared/DashboardWrapper";
import { getDraftOrder } from "@/app/[locale]/actions/draft-orders";
import DraftOrderPageClient from "./DraftOrderPageClient";
import { protectDashboardRoute } from "@/app/[locale]/lib/dashboard-auth";
import DashboardNotFound from "../../not-found";

interface DraftOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function DraftOrderPage({ params }: DraftOrderPageProps) {
  // Automatically checks route access based on navigation config
  const result = await protectDashboardRoute({
    allowedRoles: ["admin", "seller"],
    showNotFound: true,
  });

  // Render 404 content directly instead of calling notFound()
  // This ensures proper layout inheritance
  if (result.shouldShowNotFound) {
    return <DashboardNotFound />;
  }

  const { role: roleName } = result;

  const { id: draftId } = await params;

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

  // Get order events if draft was converted to an order
  let eventsList: Array<{
    id: string;
    type: string;
    visibility: string;
    message: string;
    metadata: Record<string, unknown> | null;
    createdBy: string | null;
    createdAt: Date;
  }> = [];

  if (draftData.completed && draftData.convertedToOrderId) {
    try {
      const events = await db
        .select({
          id: orderEvents.id,
          type: orderEvents.type,
          visibility: orderEvents.visibility,
          message: orderEvents.message,
          metadata: orderEvents.metadata,
          createdBy: orderEvents.createdBy,
          createdAt: orderEvents.createdAt,
        })
        .from(orderEvents)
        .where(eq(orderEvents.orderId, draftData.convertedToOrderId))
        .orderBy(desc(orderEvents.createdAt));

      eventsList = events.map((event) => ({
        id: event.id,
        type: event.type,
        visibility: event.visibility,
        message: event.message,
        metadata: event.metadata as Record<string, unknown> | null,
        createdBy: event.createdBy,
        createdAt: event.createdAt,
      }));
    } catch (error) {
      console.error("Error fetching order events:", error);
      // Keep eventsList as empty array on error
    }
  }

  // Transform draft order data to CreateOrderForm initialData format
  const initialData = {
    customerId: draftData.customerId,
    customerEmail: draftData.customerEmail || "",
    customerFirstName: draftData.customerFirstName,
    customerLastName: draftData.customerLastName,
    customerPhone: draftData.billingPhone || draftData.shippingPhone,
    lineItems: draftData.items.map((item) => {
      // Parse title to extract listing name and variant title
      const titleParts = item.title.split(" - ");
      const listingName = titleParts[0] || item.title;
      const variantTitle =
        titleParts.length > 1 ? titleParts.slice(1).join(" - ") : item.title;

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
        imageUrl: item.listingImageUrl || null,
        variantImageUrl: item.variantImageUrl || null,
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
        draftNumber={Number(draftData.draftNumber)}
        customerEmail={draftData.customerEmail}
        userRole={roleName}
        initialData={initialData}
        isCompleted={draftData.completed}
        completedAt={draftData.completedAt}
        convertedToOrderId={draftData.convertedToOrderId}
        subtotalAmount={draftData.subtotalAmount}
        discountAmount={draftData.discountAmount}
        shippingAmount={draftData.shippingAmount}
        taxAmount={draftData.taxAmount}
        totalAmount={draftData.totalAmount}
        currency={draftData.currency}
        orderEvents={eventsList}
      />
    </DashboardWrapper>
  );
}
