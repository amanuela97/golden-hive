"use server";

import { db } from "@/db";
import {
  orders,
  inventoryLocations,
  fulfillments,
  orderShipments,
  orderEvents,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getShippingRates,
  generateTrackingUrl,
  type Address,
  type Parcel,
} from "@/lib/easypost";
import { updateSellerBalance } from "./seller-balance";
import { updateOrderFulfillmentStatus } from "./orders-fulfillment-utils";
import { getStoreIdForUser } from "./orders";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { nanoid } from "nanoid";

/**
 * Get order and store addresses for shipping label purchase
 */
export async function getShippingAddresses(params: {
  orderId: string;
  storeId: string;
}): Promise<{
  success: boolean;
  error?: string;
  fromAddress?: {
    street1: string;
    street2?: string;
    city: string;
    state?: string;
    zip: string;
    country: string;
    phone?: string;
  };
  toAddress?: {
    street1: string;
    street2?: string;
    city: string;
    state?: string;
    zip: string;
    country: string;
    phone?: string;
  };
}> {
  try {
    const { orderId, storeId } = params;

    // Verify user has permission
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId: userStoreId } = await getStoreIdForUser();
    if (userStoreId !== storeId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get order shipping address
    const [order] = await db
      .select({
        shippingName: orders.shippingName,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingAddressLine2: orders.shippingAddressLine2,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        shippingPostalCode: orders.shippingPostalCode,
        shippingCountry: orders.shippingCountry,
        shippingPhone: orders.shippingPhone,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Get store origin location
    const [originLocation] = await db
      .select({
        city: inventoryLocations.city,
        state: inventoryLocations.state,
        zip: inventoryLocations.zip,
        country: inventoryLocations.country,
        address: inventoryLocations.address,
      })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.storeId, storeId))
      .limit(1);

    if (!originLocation || !originLocation.country) {
      return {
        success: false,
        error: "Store origin location not configured",
      };
    }

    return {
      success: true,
      fromAddress: {
        street1: originLocation.address || "",
        street2: undefined,
        city: originLocation.city || "",
        state: originLocation.state || undefined,
        zip: originLocation.zip || "",
        country: originLocation.country,
        phone: undefined, // Store phone can be added later if needed
      },
      toAddress: {
        street1: order.shippingAddressLine1 || "",
        street2: order.shippingAddressLine2 || undefined,
        city: order.shippingCity || "",
        state: order.shippingRegion || undefined,
        zip: order.shippingPostalCode || "",
        country: order.shippingCountry || "",
        phone: order.shippingPhone || undefined,
      },
    };
  } catch (error) {
    console.error("Error getting shipping addresses:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface AddressInput {
  street1: string;
  street2?: string;
  city: string;
  state?: string;
  zip: string;
  country: string;
  phone?: string;
}

interface GetShippingRatesParams {
  orderId: string;
  storeId: string;
  parcel: {
    weightOz: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
  };
  fromAddress?: AddressInput;
  toAddress?: AddressInput;
}

/**
 * Get international shipping rates for an order
 * Returns only international shipping services (DHL, UPS, FedEx)
 */
export async function getShippingRatesForLabel(
  params: GetShippingRatesParams
): Promise<{
  success: boolean;
  error?: string;
  rates?: Array<{
    id: string;
    carrier: string;
    service: string;
    rate: string;
    currency: string;
    estimatedDays?: number;
  }>;
  supported?: boolean;
}> {
  try {
    const { orderId, storeId, parcel } = params;

    // 1. Get order and verify it belongs to store
    const [order] = await db
      .select({
        id: orders.id,
        shippingCountry: orders.shippingCountry,
        shippingCity: orders.shippingCity,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingPostalCode: orders.shippingPostalCode,
        shippingName: orders.shippingName,
        shippingRegion: orders.shippingRegion,
        shippingPhone: orders.shippingPhone,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    // Verify order is paid
    if (order.paymentStatus !== "paid") {
      return {
        success: false,
        error: "Order must be paid before purchasing shipping label",
      };
    }

    // 2. Get store's origin location (if not provided)
    let fromAddress: Address;
    if (params.fromAddress) {
      fromAddress = {
        name: "Store", // EasyPost requires a name field
        street1: params.fromAddress.street1,
        street2: params.fromAddress.street2,
        city: params.fromAddress.city,
        state: params.fromAddress.state || "", // Default to empty string if undefined
        zip: params.fromAddress.zip,
        country: params.fromAddress.country,
        phone: params.fromAddress.phone,
      };
    } else {
      const [originLocation] = await db
        .select({
          city: inventoryLocations.city,
          state: inventoryLocations.state,
          zip: inventoryLocations.zip,
          country: inventoryLocations.country,
          address: inventoryLocations.address,
        })
        .from(inventoryLocations)
        .where(eq(inventoryLocations.storeId, storeId))
        .limit(1);

      if (!originLocation || !originLocation.country) {
        return {
          success: false,
          error: "Store origin location not configured",
        };
      }

      fromAddress = {
        name: "Store", // EasyPost requires a name field
        street1: originLocation.address || "",
        street2: undefined,
        city: originLocation.city || "",
        state: originLocation.state || "",
        zip: originLocation.zip || "",
        country: originLocation.country,
        phone: undefined, // Store phone can be added later if needed
      };
    }

    // 3. Prepare to address (use provided or order address)
    const toAddress: Address = params.toAddress
      ? {
          name: order.shippingName || "Customer", // Use order name if available
          street1: params.toAddress.street1,
          street2: params.toAddress.street2,
          city: params.toAddress.city,
          state: params.toAddress.state || "", // Default to empty string if undefined
          zip: params.toAddress.zip,
          country: params.toAddress.country,
          phone: params.toAddress.phone,
        }
      : {
          name: order.shippingName || "Customer",
          street1: order.shippingAddressLine1 || "",
          city: order.shippingCity || "",
          state: order.shippingRegion || "", // Already a string from DB
          zip: order.shippingPostalCode || "",
          country: order.shippingCountry || "",
          phone: order.shippingPhone || undefined,
        };

    // 4. Normalize country codes for comparison (uppercase)
    const fromCountry = fromAddress.country?.toUpperCase().trim() || "";
    const toCountry = toAddress.country?.toUpperCase().trim() || "";

    // Check if shipping is international
    const isInternational = fromCountry !== toCountry;

    // Note: EasyPost supports both domestic and international shipping
    // We allow both, but filter to international carriers only for international shipments

    // 5. Prepare parcel
    const easypostParcel: Parcel = {
      weight: parcel.weightOz,
      length: parcel.lengthIn,
      width: parcel.widthIn,
      height: parcel.heightIn,
    };

    // 6. Validate parcel dimensions
    // EasyPost limits: weight max 70 lbs (1120 oz), dimensions reasonable
    const MAX_WEIGHT_OZ = 1120;
    const MAX_DIMENSION_IN = 108; // 9 feet

    if (parcel.weightOz > MAX_WEIGHT_OZ) {
      return {
        success: false,
        error: `Weight exceeds maximum of ${MAX_WEIGHT_OZ} oz (${(MAX_WEIGHT_OZ / 16).toFixed(1)} lbs)`,
      };
    }

    if (
      parcel.lengthIn > MAX_DIMENSION_IN ||
      parcel.widthIn > MAX_DIMENSION_IN ||
      parcel.heightIn > MAX_DIMENSION_IN
    ) {
      return {
        success: false,
        error: `Dimensions exceed maximum of ${MAX_DIMENSION_IN} inches per side`,
      };
    }

    // 7. Get rates from EasyPost
    const rates = await getShippingRates(
      toAddress,
      fromAddress,
      easypostParcel
    );

    if (!rates || rates.length === 0) {
      return {
        success: false,
        error:
          "No shipping rates available for this route. Please use manual shipping.",
        supported: false,
      };
    }

    // 8. Filter carriers based on shipping type
    // For international: only DHL, UPS, FedEx
    // For domestic: allow all carriers (USPS, UPS, FedEx, etc.)
    let filteredRates = rates;
    if (isInternational) {
      const internationalCarriers = ["dhl", "ups", "fedex"];
      filteredRates = rates.filter((rate) =>
        internationalCarriers.includes(rate.carrier.toLowerCase())
      );

      if (filteredRates.length === 0) {
        return {
          success: false,
          error:
            "No international shipping services available for this route. Please use manual shipping.",
          supported: false,
        };
      }
    } else {
      // For domestic shipping, filter out DHL (typically international only)
      filteredRates = rates.filter(
        (rate) => rate.carrier.toLowerCase() !== "dhl"
      );

      if (filteredRates.length === 0) {
        return {
          success: false,
          error:
            "No shipping services available for this route. Please use manual shipping.",
          supported: false,
        };
      }
    }

    return {
      success: true,
      rates: filteredRates,
      supported: true,
    };
  } catch (error) {
    console.error("Error getting shipping rates:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Purchase a shipping label via EasyPost
 */
export async function purchaseShippingLabel(params: {
  orderId: string;
  storeId: string;
  rateId: string; // Keep for backward compatibility
  carrier: string; // Carrier name (e.g., "UPS", "FedEx")
  service: string; // Service name (e.g., "Ground", "Express")
  parcel: {
    weightOz: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
  };
  fromAddress?: AddressInput;
  toAddress?: AddressInput;
  labelFormat?: "PDF" | "PNG" | "ZPL";
}): Promise<{
  success: boolean;
  error?: string;
  labelUrl?: string;
  labelFileType?: string;
  trackingNumber?: string;
  carrier?: string;
  cost?: number;
}> {
  try {
    const {
      orderId,
      storeId,
      carrier,
      service,
      parcel,
      labelFormat = "PDF",
    } = params;

    // Verify user has permission
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId: userStoreId } = await getStoreIdForUser();
    if (userStoreId !== storeId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get order
    const [order] = await db
      .select({
        id: orders.id,
        shippingCountry: orders.shippingCountry,
        shippingCity: orders.shippingCity,
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingPostalCode: orders.shippingPostalCode,
        shippingName: orders.shippingName,
        shippingRegion: orders.shippingRegion,
        shippingPhone: orders.shippingPhone,
        paymentStatus: orders.paymentStatus,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.paymentStatus !== "paid") {
      return {
        success: false,
        error: "Order must be paid before purchasing shipping label",
      };
    }

    // Prepare addresses (use provided or fetch from database)
    let fromAddress: Address;
    if (params.fromAddress) {
      fromAddress = {
        name: "Store", // EasyPost requires a name field
        street1: params.fromAddress.street1,
        street2: params.fromAddress.street2,
        city: params.fromAddress.city,
        state: params.fromAddress.state || "", // Default to empty string if undefined
        zip: params.fromAddress.zip,
        country: params.fromAddress.country,
        phone: params.fromAddress.phone,
      };
    } else {
      const [originLocation] = await db
        .select({
          city: inventoryLocations.city,
          state: inventoryLocations.state,
          zip: inventoryLocations.zip,
          country: inventoryLocations.country,
          address: inventoryLocations.address,
        })
        .from(inventoryLocations)
        .where(eq(inventoryLocations.storeId, storeId))
        .limit(1);

      if (!originLocation || !originLocation.country) {
        return {
          success: false,
          error: "Store origin location not configured",
        };
      }

      fromAddress = {
        name: "Store", // EasyPost requires a name field
        street1: originLocation.address || "",
        street2: undefined,
        city: originLocation.city || "",
        state: originLocation.state || "",
        zip: originLocation.zip || "",
        country: originLocation.country,
        phone: undefined, // Store phone can be added later if needed
      };
    }

    const toAddress: Address = params.toAddress
      ? {
          name: order.shippingName || "Customer", // Use order name if available
          street1: params.toAddress.street1,
          street2: params.toAddress.street2,
          city: params.toAddress.city,
          state: params.toAddress.state || "", // Default to empty string if undefined
          zip: params.toAddress.zip,
          country: params.toAddress.country,
          phone: params.toAddress.phone,
        }
      : {
          name: order.shippingName || "Customer",
          street1: order.shippingAddressLine1 || "",
          city: order.shippingCity || "",
          state: order.shippingRegion || "", // Already a string from DB
          zip: order.shippingPostalCode || "",
          country: order.shippingCountry || "",
          phone: order.shippingPhone || undefined,
        };

    // Create shipment and purchase label
    const easypostParcel: Parcel = {
      weight: parcel.weightOz,
      length: parcel.lengthIn,
      width: parcel.widthIn,
      height: parcel.heightIn,
    };

    // Create shipment in EasyPost (without purchasing yet)
    const EasyPost = (await import("@easypost/api")).default;
    const EASYPOST_API_KEY =
      process.env.NODE_ENV === "production"
        ? process.env.EASYPOST_API_KEY_PROD
        : process.env.EASYPOST_API_KEY_TEST;
    const api = new EasyPost(EASYPOST_API_KEY || "");

    // Prepare addresses for EasyPost format
    interface PreparedAddress {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      zip: string;
      country: string;
      state?: string;
      phone?: string;
    }

    const preparedFromAddress: PreparedAddress = {
      name: "Store", // EasyPost requires a name field
      street1: fromAddress.street1,
      city: fromAddress.city,
      zip: fromAddress.zip,
      country: fromAddress.country,
    };

    if (fromAddress.street2 && fromAddress.street2.trim() !== "") {
      preparedFromAddress.street2 = fromAddress.street2;
    }

    if (fromAddress.country === "US") {
      preparedFromAddress.state = fromAddress.state.toUpperCase();
    } else if (fromAddress.state && fromAddress.state.trim() !== "") {
      preparedFromAddress.state = fromAddress.state;
    }

    // Add phone number if provided (required by some carriers like FedEx)
    if (fromAddress.phone && fromAddress.phone.trim() !== "") {
      preparedFromAddress.phone = fromAddress.phone.trim();
    }

    const preparedToAddress: PreparedAddress = {
      name: toAddress.name || "Customer", // Use order name if available
      street1: toAddress.street1,
      city: toAddress.city,
      zip: toAddress.zip,
      country: toAddress.country,
    };

    if (toAddress.country === "US") {
      preparedToAddress.state = toAddress.state.toUpperCase();
    } else if (toAddress.state && toAddress.state.trim() !== "") {
      preparedToAddress.state = toAddress.state;
    }

    // Add phone number if provided (required by some carriers like FedEx)
    if (toAddress.phone && toAddress.phone.trim() !== "") {
      preparedToAddress.phone = toAddress.phone.trim();
    }

    // Create shipment
    const shipment = await api.Shipment.create({
      to_address: preparedToAddress,
      from_address: preparedFromAddress,
      parcel: {
        length: easypostParcel.length,
        width: easypostParcel.width,
        height: easypostParcel.height,
        weight: easypostParcel.weight,
      },
    });

    // Find the rate in the shipment by carrier and service (not by ID, since IDs change per shipment)
    const rate = shipment.rates?.find(
      (r) =>
        r.carrier?.toLowerCase() === carrier.toLowerCase() &&
        r.service?.toLowerCase() === service.toLowerCase()
    );
    if (!rate) {
      console.error("Rate not found:", {
        carrier,
        service,
        availableRates: shipment.rates?.map((r) => ({
          carrier: r.carrier,
          service: r.service,
          id: r.id,
        })),
      });
      return {
        success: false,
        error: `Selected rate (${carrier} ${service}) not found in shipment. Available rates: ${shipment.rates?.map((r) => `${r.carrier} ${r.service}`).join(", ") || "none"}`,
      };
    }

    // Purchase label with selected rate
    const boughtShipment = await api.Shipment.buy(shipment.id, rate);

    const purchasedLabel = {
      id: boughtShipment.id,
      tracking_code: boughtShipment.tracking_code || "",
      carrier: boughtShipment.selected_rate?.carrier || "",
      service: boughtShipment.selected_rate?.service || "",
      rate: boughtShipment.selected_rate?.rate
        ? parseFloat(boughtShipment.selected_rate.rate)
        : 0,
      label_url: boughtShipment.postage_label?.label_url || "",
      tracking_url: boughtShipment.tracker?.public_url,
      public_url: boughtShipment.tracker?.public_url,
    };

    const labelCost = purchasedLabel.rate || 0;
    const labelCostCents = Math.round(labelCost * 100);

    // Update database in transaction
    await db.transaction(async (tx) => {
      // 1. Find or create fulfillment record
      const existingFulfillments = await tx
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.orderId, orderId),
            eq(fulfillments.storeId, storeId)
          )
        );

      if (existingFulfillments.length > 0) {
        // Update existing fulfillment
        await tx
          .update(fulfillments)
          .set({
            vendorFulfillmentStatus: "fulfilled",
            trackingNumber: purchasedLabel.tracking_code,
            carrier: purchasedLabel.carrier,
            carrierCode: purchasedLabel.carrier.toLowerCase(),
            trackingUrl: purchasedLabel.tracking_url,
            easypostShipmentId: shipment.id,
            labelUrl: purchasedLabel.label_url,
            labelFileType:
              labelFormat === "PDF"
                ? "application/pdf"
                : labelFormat === "PNG"
                  ? "image/png"
                  : "application/zpl",
            fulfilledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(fulfillments.id, existingFulfillments[0].id));
      } else {
        // Create new fulfillment
        await tx.insert(fulfillments).values({
          orderId,
          storeId,
          vendorFulfillmentStatus: "fulfilled",
          trackingNumber: purchasedLabel.tracking_code,
          carrier: purchasedLabel.carrier,
          carrierCode: purchasedLabel.carrier.toLowerCase(),
          trackingUrl: purchasedLabel.tracking_url,
          easypostShipmentId: shipment.id,
          labelUrl: purchasedLabel.label_url,
          labelFileType:
            labelFormat === "PDF"
              ? "application/pdf"
              : labelFormat === "PNG"
                ? "image/png"
                : "application/zpl",
          fulfilledBy: "seller",
          fulfilledAt: new Date(),
        });
      }

      // 2. Update orderShipments with label cost
      const [shipmentRecord] = await tx
        .select()
        .from(orderShipments)
        .where(
          and(
            eq(orderShipments.orderId, orderId),
            eq(orderShipments.storeId, storeId)
          )
        )
        .limit(1);

      if (shipmentRecord) {
        await tx
          .update(orderShipments)
          .set({
            labelCostCents: labelCostCents,
            labelCostDeducted: true,
            deductedAt: new Date(),
            trackingNumber: purchasedLabel.tracking_code,
            carrier: purchasedLabel.carrier,
            labelUrl: purchasedLabel.label_url,
            labelFileType:
              labelFormat === "PDF"
                ? "application/pdf"
                : labelFormat === "PNG"
                  ? "image/png"
                  : "application/zpl",
          })
          .where(eq(orderShipments.id, shipmentRecord.id));
      }

      // 3. Deduct label cost from seller balance
      await updateSellerBalance({
        storeId,
        type: "shipping_label",
        amount: labelCost,
        currency: rate.currency || "USD",
        orderId,
        orderShipmentId: shipmentRecord?.id,
        description: `Shipping label purchased for order`,
      });

      // 4. Update master fulfillment status
      const updatedStatus = await updateOrderFulfillmentStatus(orderId);
      console.log(
        `[Shipping Label] Updated order fulfillment status to: ${updatedStatus}`
      );

      // 5. Generate tracking token if not exists
      if (!order.trackingToken) {
        const trackingToken = nanoid(32);
        await tx
          .update(orders)
          .set({ trackingToken })
          .where(eq(orders.id, orderId));
      }

      // 6. Create order event
      await tx.insert(orderEvents).values({
        orderId,
        type: "fulfillment",
        visibility: "public",
        message: "Shipping label purchased and order marked as shipped",
        metadata: {
          carrier: purchasedLabel.carrier,
          trackingNumber: purchasedLabel.tracking_code,
          labelCost: labelCost.toFixed(2),
        },
        createdBy: session.user.id,
      });

      // 7. Generate tracking token if not exists
      let finalTrackingToken = order.trackingToken;
      if (!finalTrackingToken) {
        finalTrackingToken = nanoid(32);
        await tx
          .update(orders)
          .set({ trackingToken: finalTrackingToken })
          .where(eq(orders.id, orderId));
      }

      // 8. Send shipping notification email to customer
      if (finalTrackingToken) {
        // Send tracking notification email (async, don't await)
        Promise.resolve().then(async () => {
          try {
            const resend = (await import("@/lib/resend")).default;
            const TrackingNotificationEmail = (
              await import(
                "@/app/[locale]/components/tracking-notification-email"
              )
            ).default;

            const { orderItems } = await import("@/db/schema");
            const { listing } = await import("@/db/schema");

            const orderInfo = await db
              .select({
                customerEmail: orders.customerEmail,
                customerFirstName: orders.customerFirstName,
                customerLastName: orders.customerLastName,
                orderNumber: orders.orderNumber,
                currency: orders.currency,
                subtotalAmount: orders.subtotalAmount,
                discountAmount: orders.discountAmount,
                shippingAmount: orders.shippingAmount,
                taxAmount: orders.taxAmount,
                totalAmount: orders.totalAmount,
              })
              .from(orders)
              .where(eq(orders.id, orderId))
              .limit(1);

            if (orderInfo.length > 0 && orderInfo[0].customerEmail) {
              // Get order items
              const items = await db
                .select({
                  id: orderItems.id,
                  listingId: orderItems.listingId,
                  title: orderItems.title,
                  quantity: orderItems.quantity,
                  unitPrice: orderItems.unitPrice,
                  lineTotal: orderItems.lineTotal,
                  sku: orderItems.sku,
                })
                .from(orderItems)
                .where(eq(orderItems.orderId, orderId));

              // Get listing slugs for items
              const listingIds = items
                .map((item) => item.listingId)
                .filter((id): id is string => !!id);

              const listingMap = new Map<string, { slug: string | null }>();
              if (listingIds.length > 0) {
                const listings = await db
                  .select({
                    id: listing.id,
                    slug: listing.slug,
                  })
                  .from(listing)
                  .where(inArray(listing.id, listingIds));

                listings.forEach((l) => {
                  listingMap.set(l.id, { slug: l.slug });
                });
              }

              const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${finalTrackingToken}`;
              const customerName =
                orderInfo[0].customerFirstName && orderInfo[0].customerLastName
                  ? `${orderInfo[0].customerFirstName} ${orderInfo[0].customerLastName}`
                  : orderInfo[0].customerEmail || "Customer";

              await resend.emails.send({
                from:
                  process.env.RESEND_FROM_EMAIL ||
                  "Golden Market <goldenmarket@resend.dev>",
                to: orderInfo[0].customerEmail!,
                subject: `Your Order #${orderInfo[0].orderNumber} Has Shipped! 📦`,
                react: TrackingNotificationEmail({
                  orderNumber: orderInfo[0].orderNumber,
                  customerName,
                  trackingUrl,
                  carrier: purchasedLabel.carrier,
                  trackingNumber: purchasedLabel.tracking_code || "",
                  items: items.map((item) => {
                    const listingInfo = item.listingId
                      ? listingMap.get(item.listingId)
                      : null;
                    return {
                      title: item.title,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      lineTotal: item.lineTotal || "0",
                      sku: item.sku || null,
                      listingId: item.listingId || null,
                      listingSlug: listingInfo?.slug || null,
                    };
                  }),
                  currency: orderInfo[0].currency,
                  subtotal: orderInfo[0].subtotalAmount,
                  discount: orderInfo[0].discountAmount || "0",
                  shipping: orderInfo[0].shippingAmount || "0",
                  tax: orderInfo[0].taxAmount || "0",
                  total: orderInfo[0].totalAmount,
                }),
              });
            }
          } catch (emailError) {
            console.error("Failed to send tracking email:", emailError);
          }
        });
      }
    });

    return {
      success: true,
      labelUrl: purchasedLabel.label_url,
      labelFileType:
        labelFormat === "PDF"
          ? "application/pdf"
          : labelFormat === "PNG"
            ? "image/png"
            : "application/zpl",
      trackingNumber: purchasedLabel.tracking_code,
      carrier: purchasedLabel.carrier,
      cost: labelCost,
    };
  } catch (error) {
    console.error("Error purchasing shipping label:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark order as shipped manually (fallback)
 */
export async function markOrderShippedManually(params: {
  orderId: string;
  storeId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { orderId, storeId, carrier, trackingNumber, trackingUrl } = params;

    // Verify user has permission
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId: userStoreId } = await getStoreIdForUser();
    if (userStoreId !== storeId) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate tracking number format
    if (!trackingNumber || trackingNumber.trim().length < 5) {
      return {
        success: false,
        error: "Tracking number must be at least 5 characters",
      };
    }

    // Get order
    const [order] = await db
      .select({
        id: orders.id,
        paymentStatus: orders.paymentStatus,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.paymentStatus !== "paid") {
      return {
        success: false,
        error: "Order must be paid before marking as shipped",
      };
    }

    // Map carrier name to code
    const carrierCodeMap: Record<string, string> = {
      USPS: "usps",
      FedEx: "fedex",
      UPS: "ups",
      DHL: "dhl",
      "Canada Post": "canada_post",
      "Royal Mail": "royal_mail",
      Posti: "posti",
    };

    const carrierCode = carrierCodeMap[carrier] || carrier.toLowerCase();

    // Generate tracking URL if not provided
    const finalTrackingUrl =
      trackingUrl || generateTrackingUrl(carrier, trackingNumber);

    await db.transaction(async (tx) => {
      // 1. Find or create fulfillment record
      const existingFulfillments = await tx
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.orderId, orderId),
            eq(fulfillments.storeId, storeId)
          )
        );

      if (existingFulfillments.length > 0) {
        // Update existing fulfillment
        await tx
          .update(fulfillments)
          .set({
            vendorFulfillmentStatus: "fulfilled",
            trackingNumber,
            carrier,
            carrierCode,
            trackingUrl: finalTrackingUrl,
            fulfilledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(fulfillments.id, existingFulfillments[0].id));
      } else {
        // Create new fulfillment
        await tx.insert(fulfillments).values({
          orderId,
          storeId,
          vendorFulfillmentStatus: "fulfilled",
          trackingNumber,
          carrier,
          carrierCode,
          trackingUrl: finalTrackingUrl,
          fulfilledBy: "seller",
          fulfilledAt: new Date(),
        });
      }

      // 2. Update master fulfillment status
      const updatedStatus = await updateOrderFulfillmentStatus(orderId);
      console.log(
        `[Manual Shipping] Updated order fulfillment status to: ${updatedStatus}`
      );

      // 3. Generate tracking token if not exists
      if (!order.trackingToken) {
        const trackingToken = nanoid(32);
        await tx
          .update(orders)
          .set({ trackingToken })
          .where(eq(orders.id, orderId));
      }

      // 4. Create order event
      await tx.insert(orderEvents).values({
        orderId,
        type: "fulfillment",
        visibility: "public",
        message: "Order marked as shipped manually",
        metadata: {
          carrier,
          trackingNumber,
        },
        createdBy: session.user.id,
      });

      // 5. Check if this is first vendor to ship and send email
      const allFulfillments = await tx
        .select()
        .from(fulfillments)
        .where(eq(fulfillments.orderId, orderId));

      const isFirstVendor = allFulfillments.length === 1;

      if (isFirstVendor && order.trackingToken) {
        // Send tracking notification email (async)
        Promise.resolve().then(async () => {
          try {
            const resend = (await import("@/lib/resend")).default;
            const TrackingNotificationEmail = (
              await import(
                "@/app/[locale]/components/tracking-notification-email"
              )
            ).default;

            const orderInfo = await db
              .select({
                customerEmail: orders.customerEmail,
                customerFirstName: orders.customerFirstName,
                customerLastName: orders.customerLastName,
                orderNumber: orders.orderNumber,
              })
              .from(orders)
              .where(eq(orders.id, orderId))
              .limit(1);

            if (orderInfo.length > 0 && orderInfo[0].customerEmail) {
              const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${order.trackingToken}`;
              const customerName =
                orderInfo[0].customerFirstName && orderInfo[0].customerLastName
                  ? `${orderInfo[0].customerFirstName} ${orderInfo[0].customerLastName}`
                  : orderInfo[0].customerEmail || "Customer";

              await resend.emails.send({
                from:
                  process.env.RESEND_FROM_EMAIL ||
                  "Golden Market <goldenmarket@resend.dev>",
                to: orderInfo[0].customerEmail!,
                subject: `Your Order #${orderInfo[0].orderNumber} Has Shipped! 📦`,
                react: TrackingNotificationEmail({
                  orderNumber: orderInfo[0].orderNumber,
                  customerName,
                  trackingUrl,
                  carrier,
                  trackingNumber,
                }),
              });
            }
          } catch (emailError) {
            console.error("Failed to send tracking email:", emailError);
          }
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error marking order as shipped:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
