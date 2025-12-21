import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  orderItems,
  listing,
  listingVariants,
  customers,
  store,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

interface CreateOrderRequest {
  customerEmail: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  lineItems: Array<{
    listingId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: string;
    title: string;
    sku?: string | null;
  }>;
  currency: string;
  subtotalAmount: string;
  shippingAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
  totalAmount: string;
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
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderRequest = await req.json();

    // Validate required fields
    if (
      !body.customerEmail ||
      !body.lineItems ||
      body.lineItems.length === 0 ||
      !body.currency ||
      !body.totalAmount
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get storeId from line items (all items should be from the same store)
    const listingIds = [...new Set(body.lineItems.map((item) => item.listingId))];
    const listings = await db
      .select({ id: listing.id, storeId: listing.storeId })
      .from(listing)
      .where(inArray(listing.id, listingIds));

    if (listings.length !== listingIds.length) {
      return NextResponse.json(
        { error: "One or more listings not found" },
        { status: 400 }
      );
    }

    // Get unique store IDs
    const storeIds = [
      ...new Set(
        listings
          .map((l) => l.storeId)
          .filter((id): id is string => id !== null)
      ),
    ];

    if (storeIds.length === 0) {
      return NextResponse.json(
        { error: "No store found for listings" },
        { status: 400 }
      );
    }

    // Group line items by store
    const itemsByStore = new Map<string, typeof body.lineItems>();
    for (const item of body.lineItems) {
      const listing = listings.find((l) => l.id === item.listingId);
      if (!listing?.storeId) continue;
      
      if (!itemsByStore.has(listing.storeId)) {
        itemsByStore.set(listing.storeId, []);
      }
      itemsByStore.get(listing.storeId)!.push(item);
    }

    // Verify all stores exist and have Stripe accounts
    const allStores = await db
      .select()
      .from(store)
      .where(inArray(store.id, storeIds));

    if (allStores.length !== storeIds.length) {
      return NextResponse.json(
        { error: "One or more stores not found" },
        { status: 404 }
      );
    }

    const storesWithoutStripe = allStores.filter(
      (s) => !s.stripeAccountId
    );
    if (storesWithoutStripe.length > 0) {
      return NextResponse.json(
        {
          error: `Store(s) have not connected Stripe account: ${storesWithoutStripe.map((s) => s.name).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Create orders for each store in transaction
    return await db.transaction(async (tx) => {
      const createdOrders: Array<{ orderId: string; orderNumber: number; storeId: string }> = [];

      // Process each store separately
      for (const [storeId, storeLineItems] of itemsByStore.entries()) {
        const storeData = allStores.find((s) => s.id === storeId);
        if (!storeData) continue;
        // Find or create customer for this store
        let customerId: string | null = null;

        if (body.customerEmail) {
          const existingCustomer = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.email, body.customerEmail),
                eq(customers.storeId, storeId)
              )
            )
            .limit(1);

          if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
          } else {
            // Create new customer
            const newCustomer = await tx
              .insert(customers)
              .values({
                storeId: storeId,
                userId: null, // Guest user
                email: body.customerEmail,
                firstName: body.customerFirstName || null,
                lastName: body.customerLastName || null,
                phone: body.customerPhone || null,
              })
              .returning();

            customerId = newCustomer[0].id;
          }
        }

        // Calculate totals for this store's items
        const storeSubtotal = storeLineItems.reduce(
          (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
          0
        );
        // Pro-rate shipping, tax, and discount based on store's subtotal percentage
        const totalSubtotal = body.lineItems.reduce(
          (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
          0
        );
        const storePercentage = totalSubtotal > 0 ? storeSubtotal / totalSubtotal : 1 / storeIds.length;
        const storeShipping = (parseFloat(body.shippingAmount || "0") * storePercentage).toFixed(2);
        const storeTax = (parseFloat(body.taxAmount || "0") * storePercentage).toFixed(2);
        const storeDiscount = (parseFloat(body.discountAmount || "0") * storePercentage).toFixed(2);
        const storeTotal = (
          storeSubtotal +
          parseFloat(storeShipping) +
          parseFloat(storeTax) -
          parseFloat(storeDiscount)
        ).toFixed(2);

        // Get variant prices if needed
        const variantIds = storeLineItems
          .map((item) => item.variantId)
          .filter((id): id is string => id !== null);

        let variants: Array<{ id: string; price: string | null }> = [];
        if (variantIds.length > 0) {
          variants = await tx
            .select({
              id: listingVariants.id,
              price: listingVariants.price,
            })
            .from(listingVariants)
            .where(inArray(listingVariants.id, variantIds));
        }

        // Create order for this store
        const newOrder = await tx
          .insert(orders)
          .values({
            storeId: storeId,
            marketId: null, // Guest orders don't have market
            customerId: customerId,
            customerEmail: body.customerEmail,
            customerFirstName: body.customerFirstName || null,
            customerLastName: body.customerLastName || null,
            currency: body.currency,
            subtotalAmount: storeSubtotal.toFixed(2),
            discountAmount: storeDiscount,
            shippingAmount: storeShipping,
            taxAmount: storeTax,
            totalAmount: storeTotal,
            status: "open", // This reserves inventory
            paymentStatus: "pending",
            fulfillmentStatus: "unfulfilled",
            shippingName: body.shippingName || null,
            shippingPhone: body.shippingPhone || null,
            shippingAddressLine1: body.shippingAddressLine1 || null,
            shippingAddressLine2: body.shippingAddressLine2 || null,
            shippingCity: body.shippingCity || null,
            shippingRegion: body.shippingRegion || null,
            shippingPostalCode: body.shippingPostalCode || null,
            shippingCountry: body.shippingCountry || null,
            billingName: body.billingName || null,
            billingPhone: body.billingPhone || null,
            billingAddressLine1: body.billingAddressLine1 || null,
            billingAddressLine2: body.billingAddressLine2 || null,
            billingCity: body.billingCity || null,
            billingRegion: body.billingRegion || null,
            billingPostalCode: body.billingPostalCode || null,
            billingCountry: body.billingCountry || null,
            notes: body.notes || null, // Same notes for all orders
            placedAt: new Date(), // Order is "open" so set placedAt
          })
          .returning();

        const orderId = newOrder[0].id;
        const orderNumber = newOrder[0].orderNumber;

        createdOrders.push({
          orderId,
          orderNumber: Number(orderNumber),
          storeId,
        });

        // Create order items for this store
        for (const item of storeLineItems) {
          const variant = item.variantId
            ? variants.find((v) => v.id === item.variantId)
            : null;
          const unitPrice = variant?.price || item.unitPrice;
          const lineSubtotal = (parseFloat(unitPrice) * item.quantity).toFixed(2);
          const lineTotal = lineSubtotal;

          await tx.insert(orderItems).values({
            orderId: orderId,
            listingId: item.listingId,
            variantId: item.variantId || null,
            title: item.title,
            sku: item.sku || null,
            quantity: item.quantity,
            unitPrice: unitPrice,
            currency: body.currency,
            lineSubtotal: lineSubtotal,
            lineTotal: lineTotal,
            discountAmount: "0",
            taxAmount: "0",
          });
        }

        // Adjust inventory (reserve items) - status="open" reserves inventory
        // Import dynamically to avoid circular dependencies
        const { adjustInventoryForOrder } = await import(
          "@/app/[locale]/actions/orders"
        );
        const inventoryResult = await adjustInventoryForOrder(
          storeLineItems.map((item) => ({
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          storeId,
          "reserve",
          "order_created",
          orderId,
          true // skipAuth for guest orders
        );

        if (!inventoryResult.success) {
          throw new Error(
            inventoryResult.error || "Failed to adjust inventory"
          );
        }
      }

      // Return all created orders
      return NextResponse.json({
        success: true,
        orders: createdOrders, // Array of orders, one per store
        primaryOrderId: createdOrders[0]?.orderId, // First order ID for backward compatibility
      });
    });
  } catch (error) {
    console.error("Error creating guest order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create order",
      },
      { status: 500 }
    );
  }
}

