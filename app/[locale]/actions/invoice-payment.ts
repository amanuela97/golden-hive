"use server";

import { db } from "@/db";
import { draftOrders, draftOrderItems, store } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * Get draft order by invoice token (public access)
 */
export async function getDraftOrderByToken(
  token: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    draftNumber: number;
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

    // Get draft items
    const items = await db
      .select({
        title: draftOrderItems.title,
        quantity: draftOrderItems.quantity,
        unitPrice: draftOrderItems.unitPrice,
        lineTotal: draftOrderItems.lineTotal,
      })
      .from(draftOrderItems)
      .where(eq(draftOrderItems.draftOrderId, draft.id));

    return {
      success: true,
      data: {
        id: draft.id,
        draftNumber: Number(draft.draftNumber),
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
 */
export async function createInvoiceCheckoutSession(
  token: string
): Promise<{
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}> {
  try {
    // Get draft order by token
    const draftResult = await getDraftOrderByToken(token);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Invoice not found",
      };
    }

    const draft = draftResult.data;

    // Get store with Stripe account ID
    if (!draft.storeId) {
      return { success: false, error: "Store not found for this invoice" };
    }

    const storeData = await db
      .select({
        id: store.id,
        stripeAccountId: store.stripeAccountId,
        storeName: store.storeName,
      })
      .from(store)
      .where(eq(store.id, draft.storeId))
      .limit(1);

    if (storeData.length === 0) {
      return { success: false, error: "Store not found" };
    }

    const storeInfo = storeData[0];

    if (!storeInfo.stripeAccountId) {
      return {
        success: false,
        error:
          "Store has not connected Stripe account. Please contact support.",
      };
    }

    // Calculate amounts (convert to cents)
    const totalAmountCents = Math.round(parseFloat(draft.totalAmount) * 100);
    const platformFeeCents = Math.round(totalAmountCents * 0.05); // 5% platform fee

    // Create Stripe Checkout Session with Connect (Destination Charges)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: draft.currency.toLowerCase(),
            unit_amount: totalAmountCents,
            product_data: {
              name: `Invoice #${draft.draftNumber}`,
              description: `Payment for draft order #${draft.draftNumber}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents, // Your 5% platform fee
        on_behalf_of: storeInfo.stripeAccountId, // Compliance & reporting
        transfer_data: {
          destination: storeInfo.stripeAccountId, // Store receives the rest
        },
        metadata: {
          draftId: draft.id,
          storeId: storeInfo.id,
          invoiceToken: token,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${token}?canceled=true`,
      customer_email: draft.customerEmail || undefined,
      metadata: {
        draftId: draft.id,
        storeId: storeInfo.id,
        invoiceToken: token,
      },
    });

    return {
      success: true,
      checkoutUrl: checkoutSession.url || undefined,
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

