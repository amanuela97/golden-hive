# ShipEngine Shipping & Tracking Implementation Guide

## 📋 Overview

This guide implements ShipEngine integration with a public tracking page for a multi-vendor marketplace. The system supports:

- **Two-level fulfillment status**: Vendor-level and master order-level
- **Manual vendor fulfillment**: Vendors manually mark orders as shipped
- **Payment-gated tracking**: Fulfillment only starts after payment is confirmed
- **Public tracking page**: Customers can track orders using a secure token

## 🎯 Key Concepts

### Fulfillment Status (Two Levels)

**A) Vendor-Order Fulfillment** (per vendor, implicit in UI)

- `unfulfilled` → vendor hasn't shipped anything yet
- `partial` → vendor shipped some of their items
- `fulfilled` → vendor shipped all of their items
- `canceled` → vendor fulfillment was canceled

**B) Master Order Fulfillment** (admin + customer, derived automatically)

- `unfulfilled` → no vendor has shipped anything
- `partial` → at least one vendor shipped, but not all
- `fulfilled` → all vendors shipped all items
- `canceled` → order fulfillment canceled

**Note**: Master fulfillment status is calculated from all vendor fulfillments - no separate enum needed.

### Workflow Status (Internal Control)

- `normal` → standard processing
- `in_progress` → vendors are preparing shipments
- `on_hold` → address issue, fraud review, stock problem

**This is for ops/admin/automation, NOT customer-facing logic.**

### Order Status (Lifecycle/Archival)

- `draft` → cart / not checked out
- `open` → paid, active, in fulfillment
- `completed` → fulfilled + delivered (or closed)
- `canceled` → canceled before fulfillment
- `archived` → hidden from normal views

**This should not change frequently.**

### When Fulfillment Tracking Starts

✅ **Only when `orderPaymentStatus = 'paid'`**

- **Before payment**: No shipping, no tracking, no fulfillment
- **After payment**: Vendors are notified, fulfillment begins

### Shipping Model (MVP - Manual)

✅ **Manual by vendors** (like Etsy)

Flow:

1. Vendor logs in
2. Sees their portion of the order
3. Clicks "Mark as shipped"
4. Enters:
   - Carrier
   - Tracking number
5. System updates:
   - Vendor fulfillment status
   - Tracking info
   - Master order fulfillment status (calculated)

## Implementation Plan for ShipEngine Shipping & Tracking

Here's what you need to implement:

### 1. **Environment Setup**

First, add ShipEngine API keys to your `.env.local`:

```bash
# ShipEngine API Keys
SHIPENGINE_API_KEY_TEST=your_sandbox_key_here
SHIPENGINE_API_KEY_PROD=your_production_key_here
NODE_ENV=development
```

### 2. **Create ShipEngine Utility Library**

Create a new file `lib/shipengine.ts`:

```typescript
import axios from "axios";

const SHIPENGINE_API_URL = "https://api.shipengine.com/v1";

// Use sandbox key in development, production key in production
const SHIPENGINE_API_KEY =
  process.env.NODE_ENV === "production"
    ? process.env.SHIPENGINE_API_KEY_PROD
    : process.env.SHIPENGINE_API_KEY_TEST;

if (!SHIPENGINE_API_KEY) {
  console.warn("ShipEngine API key not configured");
}

const shipEngineClient = axios.create({
  baseURL: SHIPENGINE_API_URL,
  headers: {
    "Content-Type": "application/json",
    "API-Key": SHIPENGINE_API_KEY || "",
  },
});

export interface TrackingInfo {
  tracking_number: string;
  carrier_code: string;
  status_code:
    | "UN" // Unknown
    | "AC" // Accepted
    | "IT" // In Transit
    | "DE" // Delivered
    | "EX" // Exception
    | "AT" // Delivery Attempt
    | "NY"; // Not Yet In System
  status_description: string;
  carrier_status_code?: string;
  carrier_status_description?: string;
  ship_date?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  exception_description?: string;
  events: Array<{
    occurred_at: string;
    carrier_occurred_at?: string;
    description: string;
    city_locality?: string;
    state_province?: string;
    postal_code?: string;
    country_code?: string;
    company_name?: string;
    signer?: string;
    event_code?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

/**
 * Track a shipment using ShipEngine
 */
export async function trackShipment(
  carrierCode: string,
  trackingNumber: string
): Promise<TrackingInfo | null> {
  try {
    const response = await shipEngineClient.post<TrackingInfo>("/tracking", {
      carrier_code: carrierCode.toLowerCase(),
      tracking_number: trackingNumber,
    });

    return response.data;
  } catch (error) {
    console.error("ShipEngine tracking error:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response:", error.response?.data);
    }
    return null;
  }
}

/**
 * Register a webhook for tracking updates
 */
export async function createTrackingWebhook(
  webhookUrl: string
): Promise<{ webhook_id: string } | null> {
  try {
    const response = await shipEngineClient.post("/webhooks", {
      url: webhookUrl,
      event_types: [
        "shipment.status_updated",
        "shipment.delivered",
        "shipment.exception",
      ],
    });

    return response.data;
  } catch (error) {
    console.error("Failed to create webhook:", error);
    return null;
  }
}

/**
 * Map ShipEngine status codes to your internal fulfillment status
 */
export function mapShipEngineStatus(
  statusCode: string
): "pending" | "shipped" | "in_transit" | "delivered" | "exception" {
  switch (statusCode) {
    case "DE":
      return "delivered";
    case "IT":
      return "in_transit";
    case "AC":
      return "shipped";
    case "EX":
    case "AT":
      return "exception";
    default:
      return "pending";
  }
}

/**
 * Generate tracking URL for common carriers
 */
export function generateTrackingUrl(
  carrier: string,
  trackingNumber: string
): string {
  const carrierLower = carrier.toLowerCase();

  const trackingUrls: Record<string, string> = {
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    "canada-post": `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${trackingNumber}`,
    "royal-mail": `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`,
  };

  return (
    trackingUrls[carrierLower] ||
    `https://www.google.com/search?q=track+${carrier}+${trackingNumber}`
  );
}
```

### 3. **Database Schema**

Your schema already has the correct enums. You just need to add tracking fields to the `fulfillments` table:

**Add to `fulfillments` table:**

- `carrierCode`: text (for ShipEngine carrier codes like 'usps', 'fedex')
- `lastTrackedAt`: timestamp (last time tracking was updated)
- `trackingStatus`: text (current status from ShipEngine)
- `trackingData`: jsonb (full tracking response from ShipEngine)
- `vendorFulfillmentStatus`: orderFulfillmentStatusEnum (vendor-level status)

**Add to `orders` table:**

- `trackingToken`: text unique (for public tracking page access)

**Note**: The `orders.fulfillmentStatus` field already exists and should be calculated from all vendor fulfillments.

Update your `db/schema.ts`:

```typescript
export const fulfillments = pgTable("fulfillments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),
  storeId: uuid("store_id").references(() => store.id, {
    onDelete: "set null",
  }),
  locationId: uuid("location_id").references(() => inventoryLocations.id, {
    onDelete: "set null",
  }),
  // Vendor-level fulfillment status
  vendorFulfillmentStatus: orderFulfillmentStatusEnum(
    "vendor_fulfillment_status"
  )
    .default("unfulfilled")
    .notNull(),
  // Tracking fields
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  carrier: text("carrier"), // Display name: UPS, FedEx, etc.
  carrierCode: text("carrier_code"), // ShipEngine code: ups, fedex, usps
  trackingStatus: text("tracking_status"), // Latest status from ShipEngine
  trackingData: jsonb("tracking_data"), // Full tracking response from ShipEngine
  lastTrackedAt: timestamp("last_tracked_at"), // When tracking was last updated
  // Fulfillment metadata
  fulfilledBy: text("fulfilled_by"), // User ID who marked as shipped
  fulfilledAt: timestamp("fulfilled_at"), // When vendor marked as shipped
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const orders = pgTable("orders", {
  // ... existing fields ...
  trackingToken: text("tracking_token").unique(), // For public tracking page access
  // ... rest of fields ...
});
```

### 4. **Calculate Master Order Fulfillment Status**

Create a helper function to calculate master fulfillment status from all vendor fulfillments:

```typescript
// In app/[locale]/actions/orders-fulfillment.ts or a new utils file

import { db } from "@/db";
import { fulfillments, orders } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Calculate master order fulfillment status from all vendor fulfillments
 */
export async function calculateOrderFulfillmentStatus(
  orderId: string
): Promise<"unfulfilled" | "partial" | "fulfilled" | "canceled"> {
  const orderFulfillments = await db
    .select({
      vendorFulfillmentStatus: fulfillments.vendorFulfillmentStatus,
    })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId));

  if (orderFulfillments.length === 0) {
    return "unfulfilled";
  }

  // Check if any are canceled
  const hasCanceled = orderFulfillments.some(
    (f) => f.vendorFulfillmentStatus === "canceled"
  );
  if (hasCanceled) {
    return "canceled";
  }

  // Check if all are fulfilled
  const allFulfilled = orderFulfillments.every(
    (f) => f.vendorFulfillmentStatus === "fulfilled"
  );
  if (allFulfilled) {
    return "fulfilled";
  }

  // Check if any are fulfilled or partial
  const hasFulfilled = orderFulfillments.some(
    (f) =>
      f.vendorFulfillmentStatus === "fulfilled" ||
      f.vendorFulfillmentStatus === "partial"
  );
  if (hasFulfilled) {
    return "partial";
  }

  return "unfulfilled";
}

/**
 * Update master order fulfillment status
 */
export async function updateOrderFulfillmentStatus(orderId: string) {
  const newStatus = await calculateOrderFulfillmentStatus(orderId);

  await db
    .update(orders)
    .set({
      fulfillmentStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return newStatus;
}
```

### 5. **Server Action for Tracking**

Create `app/[locale]/actions/tracking.ts`:

```typescript
"use server";

import { db } from "@/db";
import { fulfillments, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { trackShipment, generateTrackingUrl } from "@/lib/shipengine";
import { nanoid } from "nanoid";

/**
 * Get tracking information for a fulfillment
 */
export async function getTrackingInfo(fulfillmentId: string) {
  try {
    const fulfillment = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.id, fulfillmentId))
      .limit(1);

    if (fulfillment.length === 0) {
      return { success: false, error: "Fulfillment not found" };
    }

    const record = fulfillment[0];

    if (!record.trackingNumber || !record.carrierCode) {
      return {
        success: false,
        error: "No tracking information available",
      };
    }

    // Fetch live tracking from ShipEngine
    const trackingInfo = await trackShipment(
      record.carrierCode,
      record.trackingNumber
    );

    if (!trackingInfo) {
      return {
        success: false,
        error: "Unable to fetch tracking information",
      };
    }

    // Update fulfillment with latest tracking data
    await db
      .update(fulfillments)
      .set({
        trackingStatus: trackingInfo.status_description,
        trackingData: JSON.stringify(trackingInfo),
        lastTrackedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, fulfillmentId));

    return {
      success: true,
      data: {
        trackingNumber: trackingInfo.tracking_number,
        carrier: record.carrier,
        status: trackingInfo.status_description,
        estimatedDelivery: trackingInfo.estimated_delivery_date,
        actualDelivery: trackingInfo.actual_delivery_date,
        events: trackingInfo.events,
        trackingUrl:
          record.trackingUrl ||
          generateTrackingUrl(record.carrier || "", record.trackingNumber),
      },
    };
  } catch (error) {
    console.error("Error fetching tracking info:", error);
    return {
      success: false,
      error: "Failed to fetch tracking information",
    };
  }
}

/**
 * Get tracking information by order tracking token (for public access)
 */
export async function getPublicTrackingInfo(trackingToken: string) {
  try {
    // Find order by tracking token
    const orderRecords = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        status: orders.status,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders)
      .where(eq(orders.trackingToken, trackingToken))
      .limit(1);

    if (orderRecords.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderRecords[0];

    // Get all fulfillments for this order
    const orderFulfillments = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.orderId, order.id));

    // Fetch live tracking for each fulfillment
    const trackingPromises = orderFulfillments.map(async (fulfillment) => {
      if (!fulfillment.trackingNumber || !fulfillment.carrierCode) {
        return {
          id: fulfillment.id,
          carrier: fulfillment.carrier,
          status: "No tracking available",
          events: [],
        };
      }

      const trackingInfo = await trackShipment(
        fulfillment.carrierCode,
        fulfillment.trackingNumber
      );

      // Update tracking data
      if (trackingInfo) {
        await db
          .update(fulfillments)
          .set({
            trackingStatus: trackingInfo.status_description,
            trackingData: JSON.stringify(trackingInfo),
            lastTrackedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(fulfillments.id, fulfillment.id));
      }

      return {
        id: fulfillment.id,
        carrier: fulfillment.carrier,
        carrierCode: fulfillment.carrierCode,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl:
          fulfillment.trackingUrl ||
          generateTrackingUrl(
            fulfillment.carrier || "",
            fulfillment.trackingNumber
          ),
        status: trackingInfo?.status_description || "Unknown",
        estimatedDelivery: trackingInfo?.estimated_delivery_date,
        actualDelivery: trackingInfo?.actual_delivery_date,
        events: trackingInfo?.events || [],
        fulfilledAt: fulfillment.fulfilledAt,
      };
    });

    const trackingData = await Promise.all(trackingPromises);

    return {
      success: true,
      data: {
        orderNumber: order.orderNumber,
        customerName:
          order.customerFirstName && order.customerLastName
            ? `${order.customerFirstName} ${order.customerLastName}`
            : "Customer",
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        shipments: trackingData,
      },
    };
  } catch (error) {
    console.error("Error fetching public tracking info:", error);
    return {
      success: false,
      error: "Failed to fetch tracking information",
    };
  }
}

/**
 * Generate tracking token for an order
 */
export async function generateOrderTrackingToken(orderId: string) {
  try {
    const token = nanoid(32);

    await db
      .update(orders)
      .set({
        trackingToken: token,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return { success: true, token };
  } catch (error) {
    console.error("Error generating tracking token:", error);
    return { success: false, error: "Failed to generate tracking token" };
  }
}
```

### 6. **Update Fulfillment Action (Manual Vendor Fulfillment)**

Update `app/[locale]/actions/orders-fulfillment.ts` to support manual vendor fulfillment:

**Key Requirements:**

1. Only allow fulfillment when `orderPaymentStatus = 'paid'`
2. Vendor manually enters carrier and tracking number
3. Update vendor fulfillment status
4. Calculate and update master order fulfillment status
5. Generate tracking token if it doesn't exist

```typescript
// In fulfillOrder function (app/[locale]/actions/orders-fulfillment.ts)

import { db } from "@/db";
import { fulfillments, orders, orderItems, listing } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateTrackingUrl } from "@/lib/shipengine";
import { nanoid } from "nanoid";
import { updateOrderFulfillmentStatus } from "./orders-fulfillment";

export async function fulfillOrder(input: {
  orderId: string;
  storeId: string; // Vendor's store ID
  trackingNumber: string;
  carrier: string; // Display name: "UPS", "FedEx", etc.
  trackingUrl?: string;
  fulfilledBy?: string;
}) {
  return await db.transaction(async (tx) => {
    // 1. Verify order is paid (fulfillment only starts after payment)
    const order = await tx
      .select({
        id: orders.id,
        paymentStatus: orders.paymentStatus,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (order.length === 0) {
      return { success: false, error: "Order not found" };
    }

    if (order[0].paymentStatus !== "paid") {
      return {
        success: false,
        error: "Order must be paid before fulfillment can begin",
      };
    }

    // 2. Map carrier name to ShipEngine carrier code
    const carrierCodeMap: Record<string, string> = {
      USPS: "usps",
      FedEx: "fedex",
      UPS: "ups",
      DHL: "dhl",
      "Canada Post": "canada_post",
      "Royal Mail": "royal_mail",
    };

    const carrierCode =
      carrierCodeMap[input.carrier] || input.carrier.toLowerCase();

    // 3. Generate tracking URL if not provided
    const trackingUrl =
      input.trackingUrl ||
      generateTrackingUrl(input.carrier, input.trackingNumber);

    // 4. Get vendor's items in this order to determine fulfillment status
    const vendorItems = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(listing, eq(orderItems.listingId, listing.id))
      .where(
        and(
          eq(orderItems.orderId, input.orderId),
          eq(listing.storeId, input.storeId)
        )
      );

    // 5. Check existing fulfillments for this vendor
    const existingFulfillments = await tx
      .select()
      .from(fulfillments)
      .where(
        and(
          eq(fulfillments.orderId, input.orderId),
          eq(fulfillments.storeId, input.storeId)
        )
      );

    // 6. Determine vendor fulfillment status
    // For MVP: if vendor is creating first fulfillment, mark as "fulfilled"
    // In future: calculate based on which items are fulfilled
    const vendorFulfillmentStatus: "unfulfilled" | "partial" | "fulfilled" =
      existingFulfillments.length === 0 ? "fulfilled" : "partial";

    // 7. Create fulfillment record
    const [fulfillmentRecord] = await tx
      .insert(fulfillments)
      .values({
        orderId: input.orderId,
        storeId: input.storeId,
        vendorFulfillmentStatus: vendorFulfillmentStatus,
        trackingNumber: input.trackingNumber,
        trackingUrl: trackingUrl,
        carrier: input.carrier,
        carrierCode: carrierCode,
        fulfilledBy: input.fulfilledBy || "vendor",
        fulfilledAt: new Date(),
      })
      .returning();

    // 8. Update master order fulfillment status (calculated from all vendors)
    await updateOrderFulfillmentStatus(input.orderId);

    // 9. Generate tracking token for the order if it doesn't exist
    if (!order[0].trackingToken) {
      const trackingToken = nanoid(32);
      await tx
        .update(orders)
        .set({ trackingToken })
        .where(eq(orders.id, input.orderId));
    }

    return {
      success: true,
      fulfillment: fulfillmentRecord,
    };
  });
}
```

### 7. **Public Tracking Page**

Create `app/[locale]/track/[token]/page.tsx`:

```typescript
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicTrackingInfo } from "@/app/[locale]/actions/tracking";
import TrackingPageClient from "./TrackingPageClient";

export const revalidate = 300; // Revalidate every 5 minutes

interface TrackingPageProps {
  params: Promise<{ token: string; locale: string }>;
}

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { token } = await params;

  const result = await getPublicTrackingInfo(token);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <Suspense fallback={<TrackingPageSkeleton />}>
      <TrackingPageClient trackingData={result.data} token={token} />
    </Suspense>
  );
}

function TrackingPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}
```

### 8. **Tracking Page Client Component**

Create `app/[locale]/track/[token]/TrackingPageClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { getPublicTrackingInfo } from "@/app/[locale]/actions/tracking";

interface TrackingEvent {
  occurred_at: string;
  description: string;
  city_locality?: string;
  state_province?: string;
  postal_code?: string;
  country_code?: string;
}

interface Shipment {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  estimatedDelivery?: string | null;
  actualDelivery?: string | null;
  events: TrackingEvent[];
}

interface TrackingData {
  orderNumber: string;
  customerName: string;
  status: string;
  fulfillmentStatus: string;
  shipments: Shipment[];
}

export default function TrackingPageClient({
  trackingData: initialData,
  token,
}: {
  trackingData: TrackingData;
  token: string;
}) {
  const [trackingData, setTrackingData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await getPublicTrackingInfo(token);
      if (result.success && result.data) {
        setTrackingData(result.data);
      }
    } catch (error) {
      console.error("Failed to refresh tracking:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("delivered")) {
      return "bg-green-100 text-green-800";
    }
    if (statusLower.includes("transit") || statusLower.includes("shipped")) {
      return "bg-blue-100 text-blue-800";
    }
    if (statusLower.includes("exception") || statusLower.includes("failed")) {
      return "bg-red-100 text-red-800";
    }
    return "bg-yellow-100 text-yellow-800";
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Order Tracking</h1>
            <p className="text-gray-600">Order #{trackingData.orderNumber}</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="flex gap-2">
          <Badge className={getStatusColor(trackingData.fulfillmentStatus)}>
            {trackingData.fulfillmentStatus}
          </Badge>
          <Badge variant="outline">{trackingData.status}</Badge>
        </div>
      </div>

      {/* Shipments */}
      <div className="space-y-6">
        {trackingData.shipments.map((shipment, index) => (
          <Card key={shipment.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-gray-600" />
                <div>
                  <h3 className="font-semibold text-lg">
                    Shipment {trackingData.shipments.length > 1 ? index + 1 : ""}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {shipment.carrier || "Unknown Carrier"}
                  </p>
                </div>
              </div>
              <Badge className={getStatusColor(shipment.status)}>
                {shipment.status}
              </Badge>
            </div>

            {shipment.trackingNumber && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono">
                    {shipment.trackingNumber}
                  </code>
                  {shipment.trackingUrl && (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                    >
                      Track on carrier site
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Delivery Dates */}
            {(shipment.estimatedDelivery || shipment.actualDelivery) && (
              <div className="mb-4 flex gap-4">
                {shipment.estimatedDelivery && !shipment.actualDelivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Estimated:</span>
                    <span className="font-medium">
                      {format(
                        new Date(shipment.estimatedDelivery),
                        "MMM dd, yyyy"
                      )}
                    </span>
                  </div>
                )}
                {shipment.actualDelivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-gray-600">Delivered:</span>
                    <span className="font-medium text-green-700">
                      {format(new Date(shipment.actualDelivery), "MMM dd, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tracking Events */}
            {shipment.events && shipment.events.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-3">Tracking History</h4>
                <div className="space-y-3">
                  {shipment.events.map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className="flex gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                          <span>
                            {format(
                              new Date(event.occurred_at),
                              "MMM dd, yyyy 'at' h:mm a"
                            )}
                          </span>
                          {(event.city_locality || event.state_province) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {[
                                event.city_locality,
                                event.state_province,
                                event.country_code,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Help Section */}
      <Card className="mt-8 p-6 bg-gray-50">
        <h3 className="font-semibold mb-2">Need Help?</h3>
        <p className="text-sm text-gray-600">
          If you have questions about your order, please contact our support
          team with your order number: {trackingData.orderNumber}
        </p>
      </Card>
    </div>
  );
}
```

### 9. **Email with Tracking Link**

Update the order confirmation email to include tracking link. Create `app/[locale]/components/tracking-notification-email.tsx`:

```typescript
interface TrackingNotificationEmailProps {
  orderNumber: string;
  customerName: string;
  trackingUrl: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery?: string;
}

export default function TrackingNotificationEmail({
  orderNumber,
  customerName,
  trackingUrl,
  carrier,
  trackingNumber,
  estimatedDelivery,
}: TrackingNotificationEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#333", margin: "0 0 10px 0" }}>
          Your Order Has Shipped! 📦
        </h1>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
          Order #{orderNumber}
        </p>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <p style={{ color: "#333", margin: "0 0 10px 0" }}>
          Hi {customerName},
        </p>
        <p style={{ color: "#666", lineHeight: "1.6" }}>
          Great news! Your order has been shipped and is on its way to you.
        </p>
      </div>

      {/* Tracking Info */}
      <div
        style={{
          background: "#f8f9fa",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "30px",
        }}
      >
        <p
          style={{
            margin: "0 0 10px 0",
            fontWeight: "bold",
            color: "#333",
          }}
        >
          Tracking Information
        </p>
        <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
          <strong>Carrier:</strong> {carrier}
        </p>
        <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: "14px" }}>
          <strong>Tracking Number:</strong> {trackingNumber}
        </p>
        {estimatedDelivery && (
          <p style={{ margin: "0 0 15px 0", color: "#666", fontSize: "14px" }}>
            <strong>Estimated Delivery:</strong> {estimatedDelivery}
          </p>
        )}
        <a
          href={trackingUrl}
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#007bff",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          Track Your Package
        </a>
      </div>

      <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "20px" }}>
        <p style={{ color: "#999", fontSize: "12px", lineHeight: "1.6" }}>
          If you have any questions, please don&apos;t hesitate to contact us.
        </p>
      </div>
    </div>
  );
}
```

### 10. **Send Tracking Email After Fulfillment**

Update `app/[locale]/actions/orders-fulfillment.ts` to send tracking email:

```typescript
// After successful fulfillment, send tracking email
if (result.success && input.trackingNumber) {
  try {
    const resend = (await import("@/lib/resend")).default;
    const TrackingNotificationEmail = (
      await import("@/app/[locale]/components/tracking-notification-email")
    ).default;

    // Get order details
    const orderInfo = await db
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderInfo.length > 0 && orderInfo[0].trackingToken) {
      const order = orderInfo[0];
      const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${order.trackingToken}`;

      await resend.emails.send({
        from: "Golden Market <goldenmarket@resend.dev>",
        to: order.customerEmail || "",
        subject: `Your Order #${order.orderNumber} Has Shipped`,
        react: TrackingNotificationEmail({
          orderNumber: order.orderNumber,
          customerName:
            order.customerFirstName && order.customerLastName
              ? `${order.customerFirstName} ${order.customerLastName}`
              : "Customer",
          trackingUrl,
          carrier: input.carrier || "Carrier",
          trackingNumber: input.trackingNumber,
        }),
      });
    }
  } catch (error) {
    console.error("Failed to send tracking email:", error);
    // Don't fail the fulfillment if email fails
  }
}
```

### 11. **ShipEngine Webhook Handler (Optional)**

Create `app/api/webhooks/shipengine/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fulfillments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    // Verify webhook signature (important for production)
    // const signature = req.headers.get("shipengine-signature");
    // TODO: Implement signature verification

    const { tracking_number, carrier_code, status_code, status_description } =
      event.shipment || {};

    if (!tracking_number) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Find fulfillment by tracking number and carrier
    const fulfillmentRecords = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.trackingNumber, tracking_number))
      .limit(1);

    if (fulfillmentRecords.length === 0) {
      console.log(`Fulfillment not found for tracking: ${tracking_number}`);
      return NextResponse.json({ received: true });
    }

    // Update fulfillment with new tracking data
    await db
      .update(fulfillments)
      .set({
        trackingStatus: status_description,
        trackingData: JSON.stringify(event),
        lastTrackedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, fulfillmentRecords[0].id));

    console.log(
      `Updated tracking for ${tracking_number}: ${status_description}`
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## Summary

**Implementation Checklist:**

1. ✅ Add environment variables for ShipEngine
2. ✅ Create `lib/shipengine.ts` utility
3. ✅ Update database schema (add tracking fields to fulfillments, trackingToken to orders)
4. ✅ Create fulfillment status calculation utilities
5. ✅ Create `app/[locale]/actions/tracking.ts`
6. ✅ Update `app/[locale]/actions/orders-fulfillment.ts` with:
   - Payment status check (only allow fulfillment when paid)
   - Manual vendor fulfillment flow
   - Vendor-level fulfillment status
   - Master order fulfillment status calculation
7. ✅ Create public tracking page at `app/[locale]/track/[token]/page.tsx`
8. ✅ Create `TrackingPageClient.tsx` component
9. ✅ Create tracking notification email component
10. ✅ Update fulfillment action to send tracking email
11. ✅ Create ShipEngine webhook handler (optional)
12. ✅ Run database migration

## Key Implementation Notes

### Fulfillment Status Flow

1. **Order Created** → `fulfillmentStatus: "unfulfilled"`, `paymentStatus: "pending"`
2. **Payment Confirmed** → `paymentStatus: "paid"` → Vendors can now fulfill
3. **Vendor Marks as Shipped** → Creates fulfillment with `vendorFulfillmentStatus: "fulfilled"`
4. **System Calculates Master Status** → Updates `orders.fulfillmentStatus` based on all vendor fulfillments
5. **All Vendors Shipped** → `fulfillmentStatus: "fulfilled"`

### Vendor Dashboard Flow

1. Vendor logs in → sees orders with their products
2. Vendor clicks "Mark as Shipped" on an order
3. Vendor enters:
   - Carrier (dropdown: UPS, FedEx, USPS, etc.)
   - Tracking number
4. System:
   - Creates fulfillment record
   - Sets `vendorFulfillmentStatus: "fulfilled"`
   - Calculates master `fulfillmentStatus`
   - Generates tracking token (if needed)
   - Sends tracking email to customer

### Master Fulfillment Status Calculation

```typescript
// Pseudo-code logic:
if (any vendor fulfillment is "canceled") → "canceled"
else if (all vendor fulfillments are "fulfilled") → "fulfilled"
else if (any vendor fulfillment is "fulfilled" or "partial") → "partial"
else → "unfulfilled"
```

This implementation follows your codebase conventions, supports the two-level fulfillment system, enforces payment-gated fulfillment, and provides a secure public tracking page that customers can access. The tracking page shows real-time updates from ShipEngine for all shipments in an order (supporting your multi-vendor setup).
