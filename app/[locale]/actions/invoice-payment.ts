"use server";

import { db } from "@/db";
import {
  draftOrders,
  draftOrderItems,
  store,
  listing,
  listingVariants,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * Get draft order by invoice token (public access)
 */
export async function getDraftOrderByToken(token: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    draftNumber: string;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    currency: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    items: Array<{
      title: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
      imageUrl: string | null;
      productName: string;
      variantName: string | null;
    }>;
    storeId: string | null;
  };
  error?: string;
}> {
  try {
    if (!token || typeof token !== "string") {
      return { success: false, error: "Invalid token" };
    }

    // Get draft order with token validation
    const draftData = await db
      .select({
        id: draftOrders.id,
        draftNumber: draftOrders.draftNumber,
        subtotalAmount: draftOrders.subtotalAmount,
        discountAmount: draftOrders.discountAmount,
        shippingAmount: draftOrders.shippingAmount,
        taxAmount: draftOrders.taxAmount,
        totalAmount: draftOrders.totalAmount,
        currency: draftOrders.currency,
        customerEmail: draftOrders.customerEmail,
        customerFirstName: draftOrders.customerFirstName,
        customerLastName: draftOrders.customerLastName,
        paymentStatus: draftOrders.paymentStatus,
        completed: draftOrders.completed,
        invoiceExpiresAt: draftOrders.invoiceExpiresAt,
        storeId: draftOrders.storeId,
      })
      .from(draftOrders)
      .where(
        and(
          eq(draftOrders.invoiceToken, token),
          eq(draftOrders.completed, false),
          eq(draftOrders.paymentStatus, "pending")
        )
      )
      .limit(1);

    if (draftData.length === 0) {
      return { success: false, error: "Invoice not found or already paid" };
    }

    const draft = draftData[0];

    // Check expiration
    if (
      draft.invoiceExpiresAt &&
      new Date(draft.invoiceExpiresAt) < new Date()
    ) {
      return { success: false, error: "This invoice has expired" };
    }

    // Get draft items with product images and names
    const items = await db
      .select({
        title: draftOrderItems.title,
        quantity: draftOrderItems.quantity,
        unitPrice: draftOrderItems.unitPrice,
        lineTotal: draftOrderItems.lineTotal,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
        listingName: listing.name,
        variantTitle: listingVariants.title,
      })
      .from(draftOrderItems)
      .leftJoin(listing, eq(draftOrderItems.listingId, listing.id))
      .leftJoin(
        listingVariants,
        eq(draftOrderItems.variantId, listingVariants.id)
      )
      .where(eq(draftOrderItems.draftOrderId, draft.id));

    return {
      success: true,
      data: {
        id: draft.id,
        draftNumber: draft.draftNumber,
        subtotalAmount: draft.subtotalAmount,
        discountAmount: draft.discountAmount,
        shippingAmount: draft.shippingAmount,
        taxAmount: draft.taxAmount,
        totalAmount: draft.totalAmount,
        currency: draft.currency,
        customerEmail: draft.customerEmail,
        customerFirstName: draft.customerFirstName,
        customerLastName: draft.customerLastName,
        items: items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          imageUrl: item.variantImageUrl || item.listingImageUrl || null,
          productName: item.listingName || item.title,
          variantName: item.variantTitle || null,
        })),
        storeId: draft.storeId,
      },
    };
  } catch (error) {
    console.error("Error fetching draft order by token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoice",
    };
  }
}

/**
 * Create Stripe Checkout Session for invoice payment
 * @deprecated Use API route /api/stripe/checkout/invoice instead
 */
export async function createInvoiceCheckoutSession(token: string): Promise<{
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}> {
  try {
    // Call the API route instead
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stripe/checkout/invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to create checkout session",
      };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl || data.url,
    };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create checkout session",
    };
  }
}
