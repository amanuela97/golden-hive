import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  orderItems,
  listing,
  listingVariants,
  customers,
  store,
  orderDiscounts,
  discounts,
  orderShipments,
} from "@/db/schema";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { generateOrderNumber } from "@/lib/order-number";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
    discountAmount?: string;
    discountId?: string | null;
  }>;
  currency: string;
  subtotalAmount: string;
  shippingAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
  discountId?: string | null;
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
  shippingMethod?: string | null;
  shippingService?: string | null;
  // Per-vendor shipping selections (manual rates)
  vendorShippingRates?: Array<{
    storeId: string;
    rateId: string;
    serviceName: string;
    priceCents: number;
    currency: string;
  }>;
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

    // Validate checkout permissions based on user role
    // Block admins and sellers buying from their own store
    const listingIdsForValidation = body.lineItems.map(
      (item) => item.listingId
    );
    const { validateCheckoutPermissions } = await import(
      "@/app/[locale]/actions/checkout-validation"
    );
    const permissionCheck = await validateCheckoutPermissions(
      listingIdsForValidation
    );

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        {
          error: permissionCheck.error || "Checkout not allowed",
          code: "CHECKOUT_NOT_ALLOWED",
        },
        { status: 403 }
      );
    }

    // Validate shipping availability for all items
    if (body.shippingCountry) {
      const { checkShippingAvailability } = await import(
        "@/app/[locale]/actions/shipping-availability"
      );

      const availabilityChecks = await Promise.all(
        body.lineItems.map(async (item) => {
          const availability = await checkShippingAvailability(
            item.listingId,
            body.shippingCountry!
          );
          return {
            listingId: item.listingId,
            available: availability.available,
            message: availability.message,
          };
        })
      );

      const unshippableItems = availabilityChecks.filter(
        (check) => !check.available
      );

      if (unshippableItems.length > 0) {
        return NextResponse.json(
          {
            error: "Some items cannot be shipped to the selected country",
            unshippableItems: unshippableItems.map((item) => ({
              listingId: item.listingId,
              reason: item.message,
            })),
          },
          { status: 400 }
        );
      }
    }

    // Get storeId from line items (all items should be from the same store)
    const listingIds = [
      ...new Set(body.lineItems.map((item) => item.listingId)),
    ];
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
        listings.map((l) => l.storeId).filter((id): id is string => id !== null)
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

    const storesWithoutStripe = allStores.filter((s) => !s.stripeAccountId);
    if (storesWithoutStripe.length > 0) {
      return NextResponse.json(
        {
          error: `Store(s) have not connected Stripe account: ${storesWithoutStripe.map((s) => s.storeName).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get session once before transaction (for chat room creation)
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const loggedInUserId = session?.user?.id;
    console.log("[CHECKOUT] Session check:", {
      hasSession: !!session,
      userId: loggedInUserId,
      userEmail: session?.user?.email,
    });

    // Create orders for each store in transaction
    return await db.transaction(async (tx) => {
      const createdOrders: Array<{
        orderId: string;
        orderNumber: string;
        storeId: string;
      }> = [];

      // Process each store separately
      for (const [storeId, storeLineItems] of itemsByStore.entries()) {
        const storeData = allStores.find((s) => s.id === storeId);
        if (!storeData) continue;
        // Find or create customer for this store
        let customerId: string | null = null;

        if (body.customerEmail) {
          // Check if there's a logged-in user
          const loggedInUserEmail = session?.user?.email;
          const isLoggedInUser =
            loggedInUserEmail &&
            loggedInUserEmail.toLowerCase() ===
              body.customerEmail.toLowerCase();

          let existingCustomer;

          if (isLoggedInUser && loggedInUserId) {
            // Priority 1: Check for customer with SAME userId AND SAME storeId (multi-store support)
            existingCustomer = await tx
              .select({ id: customers.id, userId: customers.userId })
              .from(customers)
              .where(
                and(
                  eq(customers.userId, loggedInUserId),
                  storeId
                    ? eq(customers.storeId, storeId)
                    : isNull(customers.storeId)
                )
              )
              .limit(1);

            // Priority 2: If no customer found for this store, check by userId only (any store)
            // This handles cases where customer was created for a different store
            if (existingCustomer.length === 0) {
              existingCustomer = await tx
                .select({ id: customers.id, userId: customers.userId })
                .from(customers)
                .where(eq(customers.userId, loggedInUserId))
                .limit(1);
            }

            // Priority 3: If still no customer found, check by email (regardless of storeId)
            // This handles cases where customer was created before userId linking was implemented
            if (existingCustomer.length === 0) {
              existingCustomer = await tx
                .select({ id: customers.id, userId: customers.userId })
                .from(customers)
                .where(eq(customers.email, body.customerEmail))
                .limit(1);
            }
          } else {
            // For guest users or different emails: Check if customer exists with SAME email AND SAME storeId
            existingCustomer = await tx
              .select({ id: customers.id, userId: customers.userId })
              .from(customers)
              .where(
                and(
                  eq(customers.email, body.customerEmail),
                  storeId
                    ? eq(customers.storeId, storeId)
                    : isNull(customers.storeId)
                )
              )
              .limit(1);
          }

          if (existingCustomer.length > 0) {
            customerId = existingCustomer[0].id;
            // Update userId if it's null but we have a logged-in user
            if (
              isLoggedInUser &&
              loggedInUserId &&
              !existingCustomer[0].userId
            ) {
              await tx
                .update(customers)
                .set({ userId: loggedInUserId })
                .where(eq(customers.id, customerId));
            }
          } else {
            // Create new customer
            const newCustomer = await tx
              .insert(customers)
              .values({
                storeId: storeId,
                userId:
                  isLoggedInUser && loggedInUserId ? loggedInUserId : null,
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

        // Calculate discount for this store's items based on item-level discounts
        // If item-level discount information is provided, use it; otherwise pro-rate
        let storeDiscount = 0;
        if (
          body.lineItems.some(
            (item) =>
              item.discountAmount && parseFloat(item.discountAmount || "0") > 0
          )
        ) {
          // Calculate discount from item-level discount amounts
          for (const item of storeLineItems) {
            const originalItem = body.lineItems.find(
              (li) =>
                li.listingId === item.listingId &&
                li.variantId === item.variantId
            );
            if (originalItem?.discountAmount) {
              storeDiscount += parseFloat(originalItem.discountAmount);
            }
          }
        } else {
          // Fallback: Pro-rate discount based on store's subtotal percentage
          const totalSubtotal = body.lineItems.reduce(
            (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
            0
          );
          const storePercentage =
            totalSubtotal > 0
              ? storeSubtotal / totalSubtotal
              : 1 / storeIds.length;
          storeDiscount =
            parseFloat(body.discountAmount || "0") * storePercentage;
        }

        // Pro-rate shipping and tax based on store's subtotal percentage
        const totalSubtotal = body.lineItems.reduce(
          (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
          0
        );
        const storePercentage =
          totalSubtotal > 0
            ? storeSubtotal / totalSubtotal
            : 1 / storeIds.length;
        const storeShipping = (
          parseFloat(body.shippingAmount || "0") * storePercentage
        ).toFixed(2);
        const storeTax = (
          parseFloat(body.taxAmount || "0") * storePercentage
        ).toFixed(2);
        const storeDiscountStr = storeDiscount.toFixed(2);
        const storeTotal = (
          storeSubtotal +
          parseFloat(storeShipping) +
          parseFloat(storeTax) -
          storeDiscount
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

        // Generate unique order number
        const generatedOrderNumber = await generateOrderNumber();

        // Create order for this store
        const newOrder = await tx
          .insert(orders)
          .values({
            orderNumber: generatedOrderNumber,
            storeId: storeId,
            marketId: null, // Guest orders don't have market
            customerId: customerId,
            customerEmail: body.customerEmail,
            customerFirstName: body.customerFirstName || null,
            customerLastName: body.customerLastName || null,
            currency: body.currency,
            subtotalAmount: storeSubtotal.toFixed(2),
            discountAmount: storeDiscountStr,
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
            shippingMethod: body.shippingMethod || null,
            shippingService: body.shippingService || null,
            placedAt: new Date(), // Order is "open" so set placedAt
          })
          .returning();

        const orderId = newOrder[0].id;
        const orderNumber = newOrder[0].orderNumber;

        // Create order discounts for this store's items
        // Collect unique discount IDs used by items in this store
        const storeDiscountIds = new Set<string>();
        let storeTotalDiscountAmount = 0;

        for (const item of storeLineItems) {
          const originalItem = body.lineItems.find(
            (li) =>
              li.listingId === item.listingId && li.variantId === item.variantId
          );
          if (originalItem?.discountId && originalItem?.discountAmount) {
            const itemDiscountAmount = parseFloat(originalItem.discountAmount);
            if (itemDiscountAmount > 0) {
              storeDiscountIds.add(originalItem.discountId);
              storeTotalDiscountAmount += itemDiscountAmount;
            }
          }
        }

        // Create order discount records for each unique discount used
        // If multiple discounts are used, we'll create multiple orderDiscount records
        // But for now, we'll create one record with the total amount
        if (storeDiscountIds.size > 0 && storeTotalDiscountAmount > 0) {
          // Get the primary discount (first one, or we could use the one with highest amount)
          const primaryDiscountId = Array.from(storeDiscountIds)[0];
          const discountData = await tx
            .select()
            .from(discounts)
            .where(eq(discounts.id, primaryDiscountId))
            .limit(1);

          if (discountData.length > 0) {
            const discount = discountData[0];
            await tx.insert(orderDiscounts).values({
              orderId: orderId,
              discountId: discount.id,
              code: discount.code,
              type: discount.type,
              valueType: discount.valueType,
              value: discount.value,
              amount: storeTotalDiscountAmount.toFixed(2),
              currency: body.currency,
            });
          }
        } else if (body.discountId && parseFloat(storeDiscountStr) > 0) {
          // Fallback: Use the provided discountId if no item-level discounts
          const discountData = await tx
            .select()
            .from(discounts)
            .where(eq(discounts.id, body.discountId))
            .limit(1);

          if (discountData.length > 0) {
            const discount = discountData[0];
            await tx.insert(orderDiscounts).values({
              orderId: orderId,
              discountId: discount.id,
              code: discount.code,
              type: discount.type,
              valueType: discount.valueType,
              value: discount.value,
              amount: storeDiscountStr,
              currency: body.currency,
            });
          }
        }

        createdOrders.push({
          orderId,
          orderNumber: orderNumber,
          storeId,
        });

        // Create order items for this store with item-level discounts
        for (const item of storeLineItems) {
          const variant = item.variantId
            ? variants.find((v) => v.id === item.variantId)
            : null;
          const unitPrice = variant?.price || item.unitPrice;
          const lineSubtotal = (parseFloat(unitPrice) * item.quantity).toFixed(
            2
          );

          // Get discount amount for this specific item
          const originalItem = body.lineItems.find(
            (li) =>
              li.listingId === item.listingId && li.variantId === item.variantId
          );
          const itemDiscountAmount = originalItem?.discountAmount
            ? parseFloat(originalItem.discountAmount)
            : 0;
          const lineTotal = (
            parseFloat(lineSubtotal) - itemDiscountAmount
          ).toFixed(2);

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
            discountAmount: itemDiscountAmount.toFixed(2),
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

        // Store shipping snapshot for this vendor if provided (manual rates)
        if (body.vendorShippingRates) {
          const vendorRate = body.vendorShippingRates.find(
            (r) => r.storeId === storeId
          );
          if (vendorRate) {
            // Get shipping profile name from the rate (if available)
            // For now, we'll use the service name as profile name
            await tx.insert(orderShipments).values({
              orderId: orderId,
              storeId: storeId,
              shippingProfileName: null, // Will be populated from rate lookup if needed
              serviceName: vendorRate.serviceName,
              priceCents: vendorRate.priceCents,
              currency: vendorRate.currency,
              carrier: null, // Manual rates don't have carrier
              trackingNumber: null,
              rateId: vendorRate.rateId, // Store the rate ID for reference
              estimatedDeliveryMin: null, // Will be calculated from processing + transit days
              estimatedDeliveryMax: null,
            });
          }
        }
      }

      // Return all created orders
      const response = NextResponse.json({
        success: true,
        orders: createdOrders, // Array of orders, one per store
        primaryOrderId: createdOrders[0]?.orderId, // First order ID for backward compatibility
      });

      // Create chat rooms AFTER transaction commits (so foreign key constraint is satisfied)
      // Do this asynchronously so it doesn't block the response
      Promise.all(
        createdOrders.map(async ({ orderId, storeId }) => {
          try {
            console.log(
              "[CHECKOUT] Starting chat room creation for order (after commit):",
              {
                orderId,
                storeId,
                loggedInUserId,
              }
            );

            // Get buyer ID - use logged-in user from session
            const buyerId = loggedInUserId;

            if (!buyerId) {
              console.log(
                "[CHECKOUT] ⚠️ Skipping chat room creation - no buyerId (guest checkout)",
                {
                  orderId,
                  storeId,
                }
              );
              return;
            }

            console.log("[CHECKOUT] Calling ensureChatRoomExists with:", {
              orderId,
              storeId,
              buyerId,
            });
            const { ensureChatRoomExists } = await import(
              "@/app/[locale]/actions/chat"
            );
            const result = await ensureChatRoomExists(
              orderId,
              storeId,
              buyerId
            );
            console.log("[CHECKOUT] ✅ Chat room creation result:", result);
          } catch (chatError) {
            // Log error but don't fail order creation
            console.error("[CHECKOUT] ❌ Error creating chat room:", {
              error: chatError,
              message:
                chatError instanceof Error
                  ? chatError.message
                  : "Unknown error",
              stack: chatError instanceof Error ? chatError.stack : undefined,
              orderId,
              storeId,
            });
          }
        })
      ).catch((error) => {
        console.error(
          "[CHECKOUT] ❌ Error in chat room creation batch:",
          error
        );
      });

      return response;
    });
  } catch (error) {
    console.error("Error creating guest order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status: 500 }
    );
  }
}
