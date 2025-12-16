"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  draftOrders,
  draftOrderItems,
  store,
  storeMembers,
  listingVariants,
  listing,
  userRoles,
  roles,
  orderEvents,
  user,
} from "@/db/schema";
import { eq, and, sql, or, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type DraftOrderRow = {
  id: string;
  draftNumber: number; // Sequential number for drafts (#D1, #D2, etc.)
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  totalAmount: string;
  currency: string;
  paymentStatus: "pending" | "paid";
  createdAt: Date;
  updatedAt: Date;
  invoiceSent: boolean; // Derived from draft events
  invoiceSentAt: Date | null;
  storeId?: string | null; // For permission checks
  completed: boolean;
};

export type DraftOrderFilters = {
  selectedView?:
    | "all"
    | "open_and_invoice_sent"
    | "open"
    | "invoice_sent"
    | "completed";
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Get store ID for current user
 */
async function getStoreIdForUser(): Promise<{
  storeId: string | null;
  isAdmin: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { storeId: null, isAdmin: false, error: "Unauthorized" };
    }

    // Check if user is admin
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    if (userRole.length === 0) {
      return { storeId: null, isAdmin: false, error: "User role not found" };
    }

    const roleName = userRole[0].roleName.toLowerCase();
    const isAdmin = roleName === "admin";

    if (isAdmin) {
      return { storeId: null, isAdmin: true };
    }

    // Get store ID for seller through storeMembers
    const storeResult = await db
      .select({ id: store.id })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, session.user.id))
      .limit(1);

    if (storeResult.length === 0) {
      return {
        storeId: null,
        isAdmin: false,
        error: "Store not found for user",
      };
    }

    return { storeId: storeResult[0].id, isAdmin: false };
  } catch (error) {
    console.error("Error getting store ID:", error);
    return {
      storeId: null,
      isAdmin: false,
      error: "Failed to get store ID",
    };
  }
}

/**
 * List draft orders with filters
 */
export async function listDraftOrders(
  filters: DraftOrderFilters = {}
): Promise<{
  success: boolean;
  data?: DraftOrderRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const {
      storeId,
      isAdmin,
      error: storeError,
    } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    // Build where conditions - only non-completed drafts
    const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [
      eq(draftOrders.completed, false),
    ];

    // Store isolation
    if (!isAdmin && storeId) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 
          FROM ${draftOrderItems} doi
          INNER JOIN ${listing} l ON doi.listing_id = l.id
          WHERE doi.draft_order_id = ${draftOrders.id}
          AND l.store_id = ${storeId}
        )`
      );
    }

    // Apply view filter
    const selectedView = filters.selectedView || "all";
    if (selectedView === "open") {
      conditions.push(eq(draftOrders.paymentStatus, "pending"));
      // TODO: Check invoice sent status (need draft_events table or metadata)
    } else if (selectedView === "invoice_sent") {
      // TODO: Check invoice sent status
    } else if (selectedView === "open_and_invoice_sent") {
      conditions.push(eq(draftOrders.paymentStatus, "pending"));
      // TODO: Check invoice sent status
    } else if (selectedView === "completed") {
      // Show completed drafts
      conditions.push(eq(draftOrders.completed, true));
    }

    // Search filter
    let searchCondition;
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      searchCondition = or(
        sql`CAST(${draftOrders.draftNumber} AS TEXT) ILIKE ${searchTerm}`,
        sql`${draftOrders.customerEmail} ILIKE ${searchTerm}`,
        sql`${draftOrders.customerFirstName} ILIKE ${searchTerm}`,
        sql`${draftOrders.customerLastName} ILIKE ${searchTerm}`,
        sql`CONCAT(${draftOrders.customerFirstName}, ' ', ${draftOrders.customerLastName}) ILIKE ${searchTerm}`
      );
    }

    // Get total count
    const countQuery = db
      .selectDistinct({ id: draftOrders.id })
      .from(draftOrders)
      .leftJoin(
        draftOrderItems,
        eq(draftOrders.id, draftOrderItems.draftOrderId)
      )
      .leftJoin(listing, eq(draftOrderItems.listingId, listing.id))
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      );

    const countResult = await countQuery;
    const totalCount = countResult.length;

    // Get paginated data
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // Get draft orders
    const draftOrdersData = await db
      .select({
        id: draftOrders.id,
        draftNumber: draftOrders.draftNumber,
        customerFirstName: draftOrders.customerFirstName,
        customerLastName: draftOrders.customerLastName,
        customerEmail: draftOrders.customerEmail,
        totalAmount: draftOrders.totalAmount,
        currency: draftOrders.currency,
        paymentStatus: draftOrders.paymentStatus,
        createdAt: draftOrders.createdAt,
        updatedAt: draftOrders.updatedAt,
        storeId: draftOrders.storeId,
        completed: draftOrders.completed,
      })
      .from(draftOrders)
      .where(
        conditions.length > 0
          ? searchCondition
            ? and(...conditions, searchCondition)
            : and(...conditions)
          : searchCondition || undefined
      )
      .orderBy(desc(draftOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    // TODO: Get invoice sent status from draft_events or metadata
    // For now, set to false
    const invoiceSentMap = new Map<string, Date>();

    return {
      success: true,
      data: draftOrdersData.map((draft) => ({
        id: draft.id,
        draftNumber: Number(draft.draftNumber),
        customerFirstName: draft.customerFirstName,
        customerLastName: draft.customerLastName,
        customerEmail: draft.customerEmail,
        totalAmount: draft.totalAmount,
        currency: draft.currency,
        paymentStatus: draft.paymentStatus as "pending" | "paid",
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        invoiceSent: invoiceSentMap.has(draft.id),
        invoiceSentAt: invoiceSentMap.get(draft.id) || null,
        storeId: draft.storeId,
        completed: draft.completed,
      })),
      totalCount,
    };
  } catch (error) {
    console.error("Error listing draft orders:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to list draft orders",
    };
  }
}

/**
 * Get draft order with items
 */
export async function getDraftOrder(draftId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    draftNumber: number;
    customerId: string | null;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    currency: string;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    paymentStatus: "pending" | "paid";
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    billingName: string | null;
    billingPhone: string | null;
    billingAddressLine1: string | null;
    billingAddressLine2: string | null;
    billingCity: string | null;
    billingRegion: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
    storeId: string | null;
    marketId: string | null;
    shippingMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      listingId: string | null;
      variantId: string | null;
      title: string;
      sku: string | null;
      quantity: number;
      unitPrice: string;
      lineSubtotal: string;
      lineTotal: string;
      currency: string;
      imageUrl: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId format
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order
    const draftData = await db
      .select({
        id: draftOrders.id,
        draftNumber: draftOrders.draftNumber,
        customerId: draftOrders.customerId,
        customerEmail: draftOrders.customerEmail,
        customerFirstName: draftOrders.customerFirstName,
        customerLastName: draftOrders.customerLastName,
        currency: draftOrders.currency,
        subtotalAmount: draftOrders.subtotalAmount,
        discountAmount: draftOrders.discountAmount,
        shippingAmount: draftOrders.shippingAmount,
        taxAmount: draftOrders.taxAmount,
        totalAmount: draftOrders.totalAmount,
        paymentStatus: draftOrders.paymentStatus,
        shippingName: draftOrders.shippingName,
        shippingPhone: draftOrders.shippingPhone,
        shippingAddressLine1: draftOrders.shippingAddressLine1,
        shippingAddressLine2: draftOrders.shippingAddressLine2,
        shippingCity: draftOrders.shippingCity,
        shippingRegion: draftOrders.shippingRegion,
        shippingPostalCode: draftOrders.shippingPostalCode,
        shippingCountry: draftOrders.shippingCountry,
        billingName: draftOrders.billingName,
        billingPhone: draftOrders.billingPhone,
        billingAddressLine1: draftOrders.billingAddressLine1,
        billingAddressLine2: draftOrders.billingAddressLine2,
        billingCity: draftOrders.billingCity,
        billingRegion: draftOrders.billingRegion,
        billingPostalCode: draftOrders.billingPostalCode,
        billingCountry: draftOrders.billingCountry,
        shippingMethod: draftOrders.shippingMethod,
        marketId: draftOrders.marketId,
        createdAt: draftOrders.createdAt,
        updatedAt: draftOrders.updatedAt,
        storeId: draftOrders.storeId,
        completed: draftOrders.completed,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftData.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    const draft = draftData[0];

    // Check if draft is completed
    if (draft.completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to view this draft order",
      };
    }

    // Get draft items
    const itemConditions: Array<ReturnType<typeof eq>> = [
      eq(draftOrderItems.draftOrderId, draftId),
    ];

    if (!isAdmin && storeId) {
      itemConditions.push(eq(listing.storeId, storeId));
    }

    const items = await db
      .select({
        id: draftOrderItems.id,
        listingId: draftOrderItems.listingId,
        variantId: draftOrderItems.variantId,
        title: draftOrderItems.title,
        sku: draftOrderItems.sku,
        quantity: draftOrderItems.quantity,
        unitPrice: draftOrderItems.unitPrice,
        lineSubtotal: draftOrderItems.lineSubtotal,
        lineTotal: draftOrderItems.lineTotal,
        currency: draftOrderItems.currency,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
      })
      .from(draftOrderItems)
      .innerJoin(listing, eq(draftOrderItems.listingId, listing.id))
      .leftJoin(
        listingVariants,
        eq(draftOrderItems.variantId, listingVariants.id)
      )
      .where(and(...itemConditions));

    const draftNumber = Number(draft.draftNumber);

    return {
      success: true,
      data: {
        id: draft.id,
        draftNumber,
        customerId: draft.customerId,
        customerEmail: draft.customerEmail,
        customerFirstName: draft.customerFirstName,
        customerLastName: draft.customerLastName,
        currency: draft.currency,
        subtotalAmount: draft.subtotalAmount,
        discountAmount: draft.discountAmount,
        shippingAmount: draft.shippingAmount,
        taxAmount: draft.taxAmount,
        totalAmount: draft.totalAmount,
        paymentStatus: draft.paymentStatus as "pending" | "paid",
        shippingName: draft.shippingName,
        shippingPhone: draft.shippingPhone,
        shippingAddressLine1: draft.shippingAddressLine1,
        shippingAddressLine2: draft.shippingAddressLine2,
        shippingCity: draft.shippingCity,
        shippingRegion: draft.shippingRegion,
        shippingPostalCode: draft.shippingPostalCode,
        shippingCountry: draft.shippingCountry,
        billingName: draft.billingName,
        billingPhone: draft.billingPhone,
        billingAddressLine1: draft.billingAddressLine1,
        billingAddressLine2: draft.billingAddressLine2,
        billingCity: draft.billingCity,
        billingRegion: draft.billingRegion,
        billingPostalCode: draft.billingPostalCode,
        billingCountry: draft.billingCountry,
        shippingMethod: draft.shippingMethod,
        marketId: draft.marketId,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        storeId: draft.storeId,
        items: items.map((item) => ({
          id: item.id,
          listingId: item.listingId,
          variantId: item.variantId,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineSubtotal: item.lineSubtotal,
          lineTotal: item.lineTotal,
          currency: item.currency,
          imageUrl: item.variantImageUrl || item.listingImageUrl || null,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch draft order",
    };
  }
}

/**
 * Delete draft order(s)
 */
export async function deleteDraftOrders(
  draftIds: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!draftIds || draftIds.length === 0) {
      return { success: false, error: "No draft orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Get drafts to check permissions
    const draftsData = await db
      .select({
        id: draftOrders.id,
        storeId: draftOrders.storeId,
        completed: draftOrders.completed,
      })
      .from(draftOrders)
      .where(inArray(draftOrders.id, draftIds));

    if (draftsData.length === 0) {
      return { success: false, error: "No draft orders found" };
    }

    // Filter to only non-completed drafts
    const validDrafts = draftsData.filter((d) => !d.completed);

    if (validDrafts.length === 0) {
      return {
        success: false,
        error: "No valid draft orders to delete (drafts may be completed)",
      };
    }

    // Check permissions
    const validDraftIds: string[] = [];
    for (const draft of validDrafts) {
      if (isAdmin) {
        validDraftIds.push(draft.id);
      } else if (storeId && draft.storeId === storeId) {
        validDraftIds.push(draft.id);
      }
    }

    if (validDraftIds.length === 0) {
      return {
        success: false,
        error: "You don't have permission to delete these draft orders",
      };
    }

    // Don't actually delete draft orders - they should remain as historical records
    // Instead, we'll mark them as deleted or just prevent deletion
    // For now, we'll prevent deletion entirely to preserve draft history

    return {
      success: false,
      error:
        "Draft orders cannot be deleted. They are kept as historical records.",
    };
  } catch (error) {
    console.error("Error deleting draft orders:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete draft orders",
    };
  }
}

/**
 * Complete draft order (convert to regular order)
 */
/**
 * Internal function to complete draft order (can be called from webhooks)
 */
async function completeDraftOrderInternal(
  draftId: string,
  markAsPaid: boolean = false,
  skipAuth: boolean = false,
  userId?: string
): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  try {
    let session: { user: { id: string } } | null = null;
    let storeId: string | null = null;
    let isAdmin = false;

    if (!skipAuth) {
      session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
      }

      const storeResult = await getStoreIdForUser();
      storeId = storeResult.storeId;
      isAdmin = storeResult.isAdmin;
    } else {
      // For webhook calls, use provided userId or empty string (will be null in events)
      session = userId ? { user: { id: userId } } : { user: { id: "" } };
    }

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order
    const draftQuery = await db
      .select({
        id: draftOrders.id,
        completed: draftOrders.completed,
        storeId: draftOrders.storeId,
        paymentStatus: draftOrders.paymentStatus,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftQuery.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    const draftCheck = draftQuery[0];

    // Check if draft is already completed
    if (draftCheck.completed) {
      return {
        success: false,
        error: "Draft order is already completed",
      };
    }

    // Check permissions (skip for webhook calls)
    if (!skipAuth && !isAdmin && draftCheck.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to complete this draft order",
      };
    }

    // Get draft with items
    const draftResult = await getDraftOrder(draftId);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Draft order not found",
      };
    }

    const draft = draftResult.data;

    // Validate draft state
    if (draft.items.length === 0) {
      return { success: false, error: "Draft order has no items" };
    }

    if (!draft.customerEmail) {
      return { success: false, error: "Draft order has no customer email" };
    }

    const draftNumber = draft.draftNumber;

    // Use transaction to create order and mark draft as completed
    return await db.transaction(async (tx) => {
      // Step 1: Create new Order record
      const newOrder = await tx
        .insert(orders)
        .values({
          storeId: draft.storeId,
          customerId: draft.customerId,
          customerEmail: draft.customerEmail,
          customerFirstName: draft.customerFirstName,
          customerLastName: draft.customerLastName,
          currency: draft.currency,
          subtotalAmount: draft.subtotalAmount,
          discountAmount: draft.discountAmount,
          shippingAmount: draft.shippingAmount,
          taxAmount: draft.taxAmount,
          totalAmount: draft.totalAmount,
          status: "open",
          paymentStatus: markAsPaid ? "paid" : "pending",
          fulfillmentStatus: "unfulfilled",
          shippingName: draft.shippingName,
          shippingPhone: draft.shippingPhone,
          shippingAddressLine1: draft.shippingAddressLine1,
          shippingAddressLine2: draft.shippingAddressLine2,
          shippingCity: draft.shippingCity,
          shippingRegion: draft.shippingRegion,
          shippingPostalCode: draft.shippingPostalCode,
          shippingCountry: draft.shippingCountry,
          billingName: draft.billingName,
          billingPhone: draft.billingPhone,
          billingAddressLine1: draft.billingAddressLine1,
          billingAddressLine2: draft.billingAddressLine2,
          billingCity: draft.billingCity,
          billingRegion: draft.billingRegion,
          billingPostalCode: draft.billingPostalCode,
          billingCountry: draft.billingCountry,
          shippingMethod: draft.shippingMethod || null,
          placedAt: new Date(),
          paidAt: markAsPaid ? new Date() : null,
        })
        .returning();

      if (newOrder.length === 0) {
        throw new Error("Failed to create order");
      }

      const orderId = newOrder[0].id;
      const orderNumber = newOrder[0].orderNumber;

      // Step 2: Copy line items from draft to order
      for (const item of draft.items) {
        await tx.insert(orderItems).values({
          orderId: orderId,
          listingId: item.listingId,
          variantId: item.variantId,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: item.currency,
          lineSubtotal: item.lineSubtotal,
          lineTotal: item.lineTotal,
          discountAmount: "0",
          taxAmount: "0",
        });
      }

      // Step 3: Adjust inventory (reserve items)
      if (draft.storeId) {
        const { adjustInventoryForOrder } = await import(
          "@/app/[locale]/actions/orders"
        );
        const inventoryResult = await adjustInventoryForOrder(
          draft.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          draft.storeId,
          "reserve",
          "order_created",
          orderId
        );

        if (!inventoryResult.success) {
          throw new Error(
            inventoryResult.error || "Failed to adjust inventory"
          );
        }
      }

      // Step 4: Generate timeline events
      const createdBy = skipAuth ? null : (session.user.id || null);
      await tx.insert(orderEvents).values([
        {
          orderId: orderId,
          type: "system",
          visibility: "internal",
          message: `Order created from draft #${draftNumber}`,
          createdBy: createdBy,
          metadata: {
            source: "draft",
            draftId: draftId,
            draftNumber: draftNumber,
            markAsPaid,
          } as Record<string, unknown>,
        },
        {
          orderId: orderId,
          type: "system",
          visibility: "internal",
          message: `Order confirmation number generated: #${orderNumber}`,
          createdBy: createdBy,
          metadata: { orderNumber } as Record<string, unknown>,
        },
      ]);

      if (markAsPaid) {
        await tx.insert(orderEvents).values({
          orderId: orderId,
          type: "payment",
          visibility: "internal",
          message: "Payment received",
          createdBy: createdBy,
          metadata: { amount: draft.totalAmount, method: skipAuth ? "stripe" : "manual" } as Record<
            string,
            unknown
          >,
        });
      }

      // Step 5: Mark draft as completed
      await tx
        .update(draftOrders)
        .set({
          completed: true,
          completedAt: new Date(),
          convertedToOrderId: orderId,
          updatedAt: new Date(),
        })
        .where(eq(draftOrders.id, draftId));

      return {
        success: true,
        orderId: orderId,
        orderNumber: Number(orderNumber),
      };
    });
  } catch (error) {
    console.error("Error completing draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to complete draft order",
    };
  }
}

/**
 * Public function to complete draft order (requires authentication)
 */
export async function completeDraftOrder(
  draftId: string,
  markAsPaid: boolean = false
): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  return completeDraftOrderInternal(draftId, markAsPaid, false);
}

/**
 * Internal function to complete draft order from webhook (no auth required)
 */
export async function completeDraftOrderFromWebhook(
  draftId: string,
  markAsPaid: boolean = false
): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  return completeDraftOrderInternal(draftId, markAsPaid, true);
}

/**
 * Send invoice for draft order
 */
export async function sendInvoice(
  draftId: string,
  email: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get full draft order with items
    const draftResult = await getDraftOrder(draftId);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Draft order not found",
      };
    }

    const draft = draftResult.data;

    // Check if draft is completed
    // Note: getDraftOrder doesn't return completed, so we need to check it separately
    const draftCheck = await db
      .select({
        completed: draftOrders.completed,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftCheck.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    if (draftCheck[0].completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to send invoice for this draft order",
      };
    }

    // Validate email
    if (!email || !email.includes("@")) {
      return { success: false, error: "Invalid email address" };
    }

    // Generate secure token and expiration
    const { generateInvoiceToken, getInvoiceExpirationDate } = await import(
      "@/lib/invoice-token"
    );
    const invoiceToken = generateInvoiceToken();
    const expiresAt = getInvoiceExpirationDate(30); // 30 days

    // Generate payment URL using token
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceToken}`;

    // Prepare email data
    const customerName =
      draft.customerFirstName && draft.customerLastName
        ? `${draft.customerFirstName} ${draft.customerLastName}`
        : draft.customerEmail || "Customer";

    // Send email using Resend
    const resend = (await import("@/lib/resend")).default;
    const DraftInvoiceEmail = (
      await import("@/app/[locale]/components/draft-invoice-email")
    ).default;

    const emailResult = await resend.emails.send({
      from: "Golden Hive <goldenhive@resend.dev>", // Update with your domain
      to: email,
      subject: `Invoice #${draft.draftNumber} - Payment Required`,
      react: DraftInvoiceEmail({
        draftNumber: draft.draftNumber,
        customerName,
        items: draft.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal: draft.subtotalAmount,
        total: draft.totalAmount,
        currency: draft.currency,
        paymentUrl,
        customMessage: message,
        expiresAt,
      }),
    });

    if (emailResult.error) {
      return {
        success: false,
        error: `Failed to send email: ${emailResult.error.message}`,
      };
    }

    // Update draft order with token and tracking
    await db
      .update(draftOrders)
      .set({
        invoiceToken: invoiceToken,
        invoiceExpiresAt: expiresAt,
        invoiceSentAt: new Date(),
        invoiceSentCount: sql`${draftOrders.invoiceSentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(draftOrders.id, draftId));

    return { success: true };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invoice",
    };
  }
}

/**
 * Mark draft order as paid (without completing it)
 * This allows marking payment before converting to order
 */
export async function markDraftOrderAsPaid(
  draftId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order
    const draftQuery = await db
      .select({
        id: draftOrders.id,
        completed: draftOrders.completed,
        storeId: draftOrders.storeId,
        paymentStatus: draftOrders.paymentStatus,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftQuery.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    const draft = draftQuery[0];

    // Check if draft is completed
    if (draft.completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check if already paid
    if (draft.paymentStatus === "paid") {
      return { success: false, error: "Draft order is already marked as paid" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to mark this draft order as paid",
      };
    }

    // Update payment status
    await db
      .update(draftOrders)
      .set({
        paymentStatus: "paid",
        updatedAt: new Date(),
      })
      .where(eq(draftOrders.id, draftId));

    return { success: true };
  } catch (error) {
    console.error("Error marking draft order as paid:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark draft order as paid",
    };
  }
}

/**
 * Update draft order items
 */
export async function updateDraftOrderItems(
  draftId: string,
  items: Array<{
    id?: string; // If provided, update existing item; if not, create new
    listingId: string;
    variantId?: string | null;
    quantity: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order
    const draftData = await db
      .select({
        id: draftOrders.id,
        completed: draftOrders.completed,
        storeId: draftOrders.storeId,
        currency: draftOrders.currency,
        subtotalAmount: draftOrders.subtotalAmount,
        discountAmount: draftOrders.discountAmount,
        shippingAmount: draftOrders.shippingAmount,
        taxAmount: draftOrders.taxAmount,
        totalAmount: draftOrders.totalAmount,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftData.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    const draft = draftData[0];

    // Check if draft is completed
    if (draft.completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to update this draft order",
      };
    }

    // Use transaction to update items and recalculate totals
    await db.transaction(async (tx) => {
      // Get existing items
      const existingItems = await tx
        .select()
        .from(draftOrderItems)
        .where(eq(draftOrderItems.draftOrderId, draftId));

      const existingItemIds = new Set(
        items.filter((item) => item.id).map((item) => item.id!)
      );

      // Delete items that are no longer in the list
      const itemsToDelete = existingItems.filter(
        (item) => !existingItemIds.has(item.id)
      );
      if (itemsToDelete.length > 0) {
        await tx.delete(draftOrderItems).where(
          inArray(
            draftOrderItems.id,
            itemsToDelete.map((item) => item.id)
          )
        );
      }

      // Update or insert items
      for (const item of items) {
        // Get listing and variant info
        const listingData = await tx
          .select({
            name: listing.name,
            imageUrl: listing.imageUrl,
          })
          .from(listing)
          .where(eq(listing.id, item.listingId))
          .limit(1);

        if (listingData.length === 0) {
          continue; // Skip invalid listings
        }

        const listingInfo = listingData[0];
        let variantInfo = null;
        if (item.variantId) {
          const variantData = await tx
            .select({
              title: listingVariants.title,
              sku: listingVariants.sku,
              price: listingVariants.price,
              imageUrl: listingVariants.imageUrl,
            })
            .from(listingVariants)
            .where(eq(listingVariants.id, item.variantId))
            .limit(1);
          variantInfo = variantData[0] || null;
        }

        const unitPrice = variantInfo?.price || "0";
        const lineSubtotal = (parseFloat(unitPrice) * item.quantity).toFixed(2);
        const lineTotal = lineSubtotal; // No discount for now

        const title = variantInfo
          ? `${listingInfo.name} - ${variantInfo.title}`
          : listingInfo.name;
        const sku = variantInfo?.sku || null;

        if (item.id) {
          // Update existing item
          await tx
            .update(draftOrderItems)
            .set({
              quantity: item.quantity,
              unitPrice: unitPrice,
              lineSubtotal: lineSubtotal,
              lineTotal: lineTotal,
            })
            .where(eq(draftOrderItems.id, item.id));
        } else {
          // Insert new item
          await tx.insert(draftOrderItems).values({
            draftOrderId: draftId,
            listingId: item.listingId,
            variantId: item.variantId || null,
            title: title,
            sku: sku,
            quantity: item.quantity,
            unitPrice: unitPrice,
            currency: draft.currency,
            lineSubtotal: lineSubtotal,
            lineTotal: lineTotal,
          });
        }
      }

      // Recalculate draft totals
      const allItems = await tx
        .select()
        .from(draftOrderItems)
        .where(eq(draftOrderItems.draftOrderId, draftId));

      const newSubtotal = allItems.reduce(
        (sum, item) => sum + parseFloat(item.lineSubtotal || "0"),
        0
      );
      const discount = parseFloat(draft.discountAmount || "0");
      const shipping = parseFloat(draft.shippingAmount || "0");
      const tax = parseFloat(draft.taxAmount || "0");
      const total = newSubtotal - discount + shipping + tax;

      // Update draft totals
      await tx
        .update(draftOrders)
        .set({
          subtotalAmount: newSubtotal.toFixed(2),
          totalAmount: total.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(draftOrders.id, draftId));
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating draft order items:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update draft order items",
    };
  }
}

/**
 * Create a new draft order
 */
export async function createDraftOrder(input: {
  customerId: string | null;
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerPhone: string | null;
  lineItems: Array<{
    listingId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: string;
    title: string;
    sku: string | null;
  }>;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentStatus?: "pending" | "paid";
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  billingName?: string | null;
  billingPhone?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingCity?: string | null;
  billingRegion?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  notes?: string | null;
  shippingMethod?: string | null;
}): Promise<{
  success: boolean;
  draftId?: string;
  draftNumber?: number;
  error?: string;
}> {
  try {
    const {
      storeId,
      isAdmin,
      error: storeError,
    } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    if (!isAdmin && !storeId) {
      return { success: false, error: "Store not found" };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's marketId
    const userData = await db
      .select({ marketId: user.marketId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    const userMarketId = userData.length > 0 ? userData[0].marketId : null;

    // Use transaction to create draft and items
    return await db.transaction(async (tx) => {
      // Determine storeId (for admins, get from line items)
      let finalStoreId = storeId;

      if (isAdmin && input.lineItems.length > 0) {
        const listingIds = [
          ...new Set(input.lineItems.map((item) => item.listingId)),
        ];
        const listingsResult = await tx
          .select({ storeId: listing.storeId })
          .from(listing)
          .where(inArray(listing.id, listingIds))
          .limit(1);
        if (listingsResult.length > 0) {
          finalStoreId = listingsResult[0].storeId;
        }
      }

      // Create draft order
      const newDraft = await tx
        .insert(draftOrders)
        .values({
          storeId: finalStoreId,
          marketId: userMarketId, // Snapshot market at transaction time
          customerId: input.customerId,
          customerEmail: input.customerEmail,
          customerFirstName: input.customerFirstName,
          customerLastName: input.customerLastName,
          currency: input.currency,
          subtotalAmount: input.subtotalAmount,
          discountAmount: input.discountAmount,
          shippingAmount: input.shippingAmount,
          taxAmount: input.taxAmount,
          totalAmount: input.totalAmount,
          paymentStatus: input.paymentStatus || "pending",
          shippingName: input.shippingName,
          shippingPhone: input.shippingPhone,
          shippingAddressLine1: input.shippingAddressLine1,
          shippingAddressLine2: input.shippingAddressLine2,
          shippingCity: input.shippingCity,
          shippingRegion: input.shippingRegion,
          shippingPostalCode: input.shippingPostalCode,
          shippingCountry: input.shippingCountry,
          billingName: input.billingName,
          billingPhone: input.billingPhone,
          billingAddressLine1: input.billingAddressLine1,
          billingAddressLine2: input.billingAddressLine2,
          billingCity: input.billingCity,
          billingRegion: input.billingRegion,
          billingPostalCode: input.billingPostalCode,
          billingCountry: input.billingCountry,
          notes: input.notes,
          shippingMethod: input.shippingMethod,
          completed: false,
        })
        .returning();

      const draftId = newDraft[0].id;
      const draftNumber = newDraft[0].draftNumber;

      // Create draft items
      for (const item of input.lineItems) {
        const lineSubtotal = (
          parseFloat(item.unitPrice) * item.quantity
        ).toFixed(2);
        const lineTotal = lineSubtotal;

        await tx.insert(draftOrderItems).values({
          draftOrderId: draftId,
          listingId: item.listingId,
          variantId: item.variantId || null,
          title: item.title,
          sku: item.sku || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: input.currency,
          lineSubtotal: lineSubtotal,
          lineTotal: lineTotal,
          discountAmount: "0",
          taxAmount: "0",
        });
      }

      return {
        success: true,
        draftId: draftId,
        draftNumber: Number(draftNumber),
      };
    });
  } catch (error) {
    console.error("Error creating draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create draft order",
    };
  }
}

/**
 * Duplicate draft order
 */
export async function duplicateDraftOrder(draftId: string): Promise<{
  success: boolean;
  newDraftId?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order with items
    const draftResult = await getDraftOrder(draftId);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Draft order not found",
      };
    }

    const draft = draftResult.data;

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to duplicate this draft order",
      };
    }

    // Create new draft order
    const newDraft = await db
      .insert(draftOrders)
      .values({
        storeId: draft.storeId,
        customerId: draft.customerId,
        customerEmail: draft.customerEmail,
        customerFirstName: draft.customerFirstName,
        customerLastName: draft.customerLastName,
        currency: draft.currency,
        subtotalAmount: draft.subtotalAmount,
        discountAmount: draft.discountAmount,
        shippingAmount: draft.shippingAmount,
        taxAmount: draft.taxAmount,
        totalAmount: draft.totalAmount,
        paymentStatus: "pending",
        shippingName: draft.shippingName,
        shippingPhone: draft.shippingPhone,
        shippingAddressLine1: draft.shippingAddressLine1,
        shippingAddressLine2: draft.shippingAddressLine2,
        shippingCity: draft.shippingCity,
        shippingRegion: draft.shippingRegion,
        shippingPostalCode: draft.shippingPostalCode,
        shippingCountry: draft.shippingCountry,
        billingName: draft.billingName,
        billingPhone: draft.billingPhone,
        billingAddressLine1: draft.billingAddressLine1,
        billingAddressLine2: draft.billingAddressLine2,
        billingCity: draft.billingCity,
        billingRegion: draft.billingRegion,
        billingPostalCode: draft.billingPostalCode,
        billingCountry: draft.billingCountry,
        shippingMethod: draft.shippingMethod,
        completed: false,
      })
      .returning();

    const newDraftId = newDraft[0].id;

    // Copy items
    for (const item of draft.items) {
      await db.insert(draftOrderItems).values({
        draftOrderId: newDraftId,
        listingId: item.listingId,
        variantId: item.variantId,
        title: item.title,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        lineSubtotal: item.lineSubtotal,
        lineTotal: item.lineTotal,
      });
    }

    return { success: true, newDraftId };
  } catch (error) {
    console.error("Error duplicating draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to duplicate draft order",
    };
  }
}

/**
 * Update a draft order (customer info, addresses, items, totals)
 */
export async function updateDraftOrder(
  draftId: string,
  input: {
    customerId: string | null;
    customerEmail: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerPhone: string | null;
    lineItems: Array<{
      id?: string;
      listingId: string;
      variantId?: string | null;
      quantity: number;
      unitPrice: string;
      title: string;
      sku: string | null;
    }>;
    currency: string;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    paymentStatus?: "pending" | "paid";
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingAddressLine1?: string | null;
    shippingAddressLine2?: string | null;
    shippingCity?: string | null;
    shippingRegion?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
    billingName?: string | null;
    billingPhone?: string | null;
    billingAddressLine1?: string | null;
    billingAddressLine2?: string | null;
    billingCity?: string | null;
    billingRegion?: string | null;
    billingPostalCode?: string | null;
    billingCountry?: string | null;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get draft order
    const draftData = await db
      .select({
        id: draftOrders.id,
        completed: draftOrders.completed,
        storeId: draftOrders.storeId,
      })
      .from(draftOrders)
      .where(eq(draftOrders.id, draftId))
      .limit(1);

    if (draftData.length === 0) {
      return { success: false, error: "Draft order not found" };
    }

    const draft = draftData[0];

    // Check if draft is completed
    if (draft.completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to update this draft order",
      };
    }

    // Use transaction to update draft and items
    await db.transaction(async (tx) => {
      // Update draft order
      await tx
        .update(draftOrders)
        .set({
          customerId: input.customerId,
          customerEmail: input.customerEmail,
          customerFirstName: input.customerFirstName,
          customerLastName: input.customerLastName,
          customerPhone: input.customerPhone,
          currency: input.currency,
          subtotalAmount: input.subtotalAmount,
          discountAmount: input.discountAmount,
          shippingAmount: input.shippingAmount,
          taxAmount: input.taxAmount,
          totalAmount: input.totalAmount,
          paymentStatus: input.paymentStatus || "pending",
          shippingName: input.shippingName,
          shippingPhone: input.shippingPhone,
          shippingAddressLine1: input.shippingAddressLine1,
          shippingAddressLine2: input.shippingAddressLine2,
          shippingCity: input.shippingCity,
          shippingRegion: input.shippingRegion,
          shippingPostalCode: input.shippingPostalCode,
          shippingCountry: input.shippingCountry,
          billingName: input.billingName,
          billingPhone: input.billingPhone,
          billingAddressLine1: input.billingAddressLine1,
          billingAddressLine2: input.billingAddressLine2,
          billingCity: input.billingCity,
          billingRegion: input.billingRegion,
          billingPostalCode: input.billingPostalCode,
          billingCountry: input.billingCountry,
          updatedAt: new Date(),
        })
        .where(eq(draftOrders.id, draftId));

      // Update items using existing function logic
      const existingItems = await tx
        .select()
        .from(draftOrderItems)
        .where(eq(draftOrderItems.draftOrderId, draftId));

      const existingItemIds = new Set(
        input.lineItems.filter((item) => item.id).map((item) => item.id!)
      );

      // Delete items that are no longer in the list
      const itemsToDelete = existingItems.filter(
        (item) => !existingItemIds.has(item.id)
      );
      if (itemsToDelete.length > 0) {
        await tx.delete(draftOrderItems).where(
          inArray(
            draftOrderItems.id,
            itemsToDelete.map((item) => item.id)
          )
        );
      }

      // Update or insert items
      for (const item of input.lineItems) {
        const listingData = await tx
          .select({
            name: listing.name,
            imageUrl: listing.imageUrl,
          })
          .from(listing)
          .where(eq(listing.id, item.listingId))
          .limit(1);

        if (listingData.length === 0) {
          continue;
        }

        const variantData = item.variantId
          ? await tx
              .select({
                title: listingVariants.title,
                imageUrl: listingVariants.imageUrl,
                sku: listingVariants.sku,
              })
              .from(listingVariants)
              .where(eq(listingVariants.id, item.variantId))
              .limit(1)
          : [];

        const variant = variantData.length > 0 ? variantData[0] : null;
        const itemTitle = variant
          ? `${listingData[0].name} - ${variant.title}`
          : listingData[0].name;
        const itemImageUrl = variant?.imageUrl || listingData[0].imageUrl;
        const itemSku = variant?.sku || item.sku;

        if (item.id && existingItemIds.has(item.id)) {
          // Update existing item
          await tx
            .update(draftOrderItems)
            .set({
              listingId: item.listingId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              title: itemTitle,
              sku: itemSku,
              imageUrl: itemImageUrl,
            })
            .where(eq(draftOrderItems.id, item.id));
        } else {
          // Insert new item
          await tx.insert(draftOrderItems).values({
            draftOrderId: draftId,
            listingId: item.listingId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            title: itemTitle,
            sku: itemSku,
            imageUrl: itemImageUrl,
          });
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update draft order",
    };
  }
}
