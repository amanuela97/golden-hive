# EasyPost Shipping Rates & Tracking Implementation Guide

## 📋 Overview

This guide implements EasyPost shipping rate calculation and tracking for a multi-vendor marketplace. The system supports:

- **Shipping rate calculation** at checkout using EasyPost API
- **Multi-vendor shipping** - each vendor's items calculated separately
- **Carrier selection** - customers and admins can choose shipping options
- **Weight & dimensions** - stored in OZ and IN, with metric input support
- **Draft order shipping** - admins/sellers can set shipping rates when creating orders
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

## Implementation Plan for EasyPost Shipping Rates & Tracking

### 1. **Environment Setup**

Add EasyPost API keys to your `.env.local`:

```bash
# EasyPost API Keys
EASYPOST_API_KEY_TEST=your_sandbox_key_here
EASYPOST_API_KEY_PROD=your_production_key_here
NODE_ENV=development
```

**Note**: EasyPost sandbox doesn't charge real money — perfect for MVP testing.

### 2. **Database Schema Modifications**

#### ✅ **REQUIRED: Update `inventoryItems` table**

Add dimensions and convert weight to ounces:

```typescript
// In db/schema.ts - inventoryItems table
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => listingVariants.id, { onDelete: "cascade" }),
  costPerItem: numeric("cost_per_item", { precision: 10, scale: 2 }).default(
    "0"
  ),
  requiresShipping: boolean("requires_shipping").default(true),
  // Weight in OUNCES (OZ) - stored with 1 decimal precision
  weightOz: numeric("weight_oz", { precision: 8, scale: 1 }).default("0"),
  // Dimensions in INCHES (IN) - stored with 1 decimal precision
  lengthIn: numeric("length_in", { precision: 8, scale: 1 }).default("0"),
  widthIn: numeric("width_in", { precision: 8, scale: 1 }).default("0"),
  heightIn: numeric("height_in", { precision: 8, scale: 1 }).default("0"),
  countryOfOrigin: text("country_of_origin"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

**Migration Note**: You'll need to:

1. Add new columns (`weightOz`, `lengthIn`, `widthIn`, `heightIn`)
2. Migrate existing `weightGrams` to `weightOz` (1 gram = 0.035274 ounces)
3. Optionally keep `weightGrams` for backward compatibility or remove it after migration

#### ✅ **REQUIRED: Update `orders` table**

Add shipping carrier and rate information:

```typescript
// In db/schema.ts - orders table (add these fields)
export const orders = pgTable("orders", {
  // ... existing fields ...
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  shippingMethod: text("shipping_method"), // Shipping method name
  // NEW: Shipping rate details
  shippingCarrier: text("shipping_carrier"), // Selected carrier (e.g., "USPS", "FedEx")
  shippingService: text("shipping_service"), // Service level (e.g., "Priority", "Express")
  shippingRateId: text("shipping_rate_id"), // EasyPost rate ID (for label purchase)
  // ... rest of fields ...
});
```

#### ✅ **REQUIRED: Update `draftOrders` table**

Add same shipping fields as orders:

```typescript
// In db/schema.ts - draftOrders table (add these fields)
export const draftOrders = pgTable("draft_orders", {
  // ... existing fields ...
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  shippingMethod: text("shipping_method"), // Shipping method name
  // NEW: Shipping rate details
  shippingCarrier: text("shipping_carrier"), // Selected carrier (e.g., "USPS", "FedEx")
  shippingService: text("shipping_service"), // Service level (e.g., "Priority", "Express")
  shippingRateId: text("shipping_rate_id"), // EasyPost rate ID (for label purchase)
  // ... rest of fields ...
});
```

#### ✅ **Already exists: `fulfillments` table**

The fulfillments table already has the required tracking fields from the previous implementation.

### 3. **Unit Conversion Utilities**

Create `lib/shipping-utils.ts` for unit conversions:

```typescript
/**
 * Convert weight from grams to ounces
 * 1 gram = 0.035274 ounces
 */
export function gramsToOunces(grams: number): number {
  return parseFloat((grams * 0.035274).toFixed(1));
}

/**
 * Convert weight from kilograms to ounces
 * 1 kg = 35.274 ounces
 */
export function kilogramsToOunces(kg: number): number {
  return parseFloat((kg * 35.274).toFixed(1));
}

/**
 * Convert weight from ounces to grams
 */
export function ouncesToGrams(oz: number): number {
  return Math.round(oz / 0.035274);
}

/**
 * Convert length from centimeters to inches
 * 1 cm = 0.393701 inches
 */
export function centimetersToInches(cm: number): number {
  return parseFloat((cm * 0.393701).toFixed(1));
}

/**
 * Convert length from meters to inches
 * 1 m = 39.3701 inches
 */
export function metersToInches(m: number): number {
  return parseFloat((m * 39.3701).toFixed(1));
}

/**
 * Convert length from inches to centimeters
 */
export function inchesToCentimeters(inches: number): number {
  return Math.round(inches / 0.393701);
}
```

### 4. **EasyPost Utility Library**

The `lib/easypost.ts` file already exists from the previous implementation. Add shipping rate functions:

```typescript
// Add to lib/easypost.ts

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate: string; // Price as string
  currency: string;
  estimated_days?: number;
}

/**
 * Get shipping rates for a shipment (without purchasing)
 */
export async function getShippingRates(
  toAddress: Address,
  fromAddress: Address,
  parcel: Parcel
): Promise<ShippingRate[] | null> {
  try {
    const shipment = await api.Shipment.create({
      to_address: toAddress,
      from_address: fromAddress,
      parcel: parcel,
    });

    // Return all available rates
    return (shipment.rates || []).map((rate) => ({
      id: rate.id,
      carrier: rate.carrier,
      service: rate.service,
      rate: rate.rate,
      currency: rate.currency || "USD",
      estimated_days: rate.est_delivery_days,
    }));
  } catch (error) {
    console.error("EasyPost shipping rates error:", error);
    return null;
  }
}

/**
 * Purchase a shipment using a specific rate ID
 */
export async function purchaseShipmentWithRate(
  shipmentId: string,
  rateId: string
): Promise<ShipmentInfo | null> {
  try {
    const shipment = await api.Shipment.retrieve(shipmentId);
    const rate = shipment.rates.find((r) => r.id === rateId);

    if (!rate) {
      console.error("Rate not found:", rateId);
      return null;
    }

    const boughtShipment = await shipment.buy(rate);

    return {
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
  } catch (error) {
    console.error("EasyPost shipment purchase error:", error);
    return null;
  }
}
```

### 5. **Calculate Parcel Dimensions from Order Items**

Create `app/[locale]/actions/shipping-rates.ts`:

```typescript
"use server";

import { db } from "@/db";
import {
  orderItems,
  listingVariants,
  inventoryItems,
  listing,
  store,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getShippingRates, type Address } from "@/lib/easypost";
import type { ShippingRate } from "@/lib/easypost";

interface OrderItemWithShipping {
  listingId: string;
  variantId: string | null;
  quantity: number;
  storeId: string;
}

/**
 * Calculate parcel dimensions and weight for a group of items
 * Uses max dimensions for length/width, sums height (stacking), sums weight
 */
function calculateParcelFromItems(
  items: Array<{
    weightOz: number;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    quantity: number;
  }>
): {
  length: number;
  width: number;
  height: number;
  weight: number;
} {
  if (items.length === 0) {
    return { length: 0, width: 0, height: 0, weight: 0 };
  }

  // Use max dimensions for length and width (items side by side)
  const length = Math.max(...items.map((i) => i.lengthIn), 0);
  const width = Math.max(...items.map((i) => i.widthIn), 0);

  // Sum height (items stacked vertically)
  const height = items.reduce(
    (sum, item) => sum + item.heightIn * item.quantity,
    0
  );

  // Sum weight (all items)
  const weight = items.reduce(
    (sum, item) => sum + item.weightOz * item.quantity,
    0
  );

  return {
    length: parseFloat(length.toFixed(1)),
    width: parseFloat(width.toFixed(1)),
    height: parseFloat(height.toFixed(1)),
    weight: parseFloat(weight.toFixed(1)),
  };
}

/**
 * Get shipping rates for order items grouped by vendor
 */
export async function getShippingRatesForOrder(
  items: OrderItemWithShipping[],
  toAddress: Address
): Promise<{
  success: boolean;
  rates?: Array<{
    storeId: string;
    storeName: string;
    rates: ShippingRate[];
    parcel: {
      length: number;
      width: number;
      height: number;
      weight: number;
    };
  }>;
  error?: string;
}> {
  try {
    // Group items by storeId
    const itemsByStore = items.reduce(
      (acc, item) => {
        if (!acc[item.storeId]) {
          acc[item.storeId] = [];
        }
        acc[item.storeId].push(item);
        return acc;
      },
      {} as Record<string, OrderItemWithShipping[]>
    );

    // Get store information
    const storeIds = Object.keys(itemsByStore);
    const stores = await db
      .select({
        id: store.id,
        name: store.name,
        addressLine1: store.addressLine1,
        addressLine2: store.addressLine2,
        city: store.city,
        region: store.region,
        postalCode: store.postalCode,
        country: store.country,
      })
      .from(store)
      .where(inArray(store.id, storeIds));

    const storeMap = new Map(stores.map((s) => [s.id, s]));

    // Get variant IDs
    const variantIds = items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== null);

    // Get inventory items with weight and dimensions
    const inventoryData = await db
      .select({
        variantId: inventoryItems.variantId,
        weightOz: inventoryItems.weightOz,
        lengthIn: inventoryItems.lengthIn,
        widthIn: inventoryItems.widthIn,
        heightIn: inventoryItems.heightIn,
      })
      .from(inventoryItems)
      .where(inArray(inventoryItems.variantId, variantIds));

    const inventoryMap = new Map(
      inventoryData.map((inv) => [inv.variantId, inv])
    );

    // Calculate rates per store
    const ratesByStore = await Promise.all(
      Object.entries(itemsByStore).map(async ([storeId, storeItems]) => {
        const storeInfo = storeMap.get(storeId);
        if (!storeInfo) {
          return null;
        }

        // Get parcel dimensions for this store's items
        const parcelItems = storeItems
          .map((item) => {
            const inventory = item.variantId
              ? inventoryMap.get(item.variantId)
              : null;
            return {
              weightOz: inventory?.weightOz
                ? parseFloat(inventory.weightOz)
                : 0,
              lengthIn: inventory?.lengthIn
                ? parseFloat(inventory.lengthIn)
                : 0,
              widthIn: inventory?.widthIn ? parseFloat(inventory.widthIn) : 0,
              heightIn: inventory?.heightIn
                ? parseFloat(inventory.heightIn)
                : 0,
              quantity: item.quantity,
            };
          })
          .filter((item) => item.weightOz > 0); // Only include items with weight

        if (parcelItems.length === 0) {
          return {
            storeId,
            storeName: storeInfo.name,
            rates: [],
            parcel: { length: 0, width: 0, height: 0, weight: 0 },
          };
        }

        const parcel = calculateParcelFromItems(parcelItems);

        // Build from address from store info
        const fromAddress: Address = {
          name: storeInfo.name,
          street1: storeInfo.addressLine1 || "",
          street2: storeInfo.addressLine2 || undefined,
          city: storeInfo.city || "",
          state: storeInfo.region || "",
          zip: storeInfo.postalCode || "",
          country: storeInfo.country || "US",
        };

        // Get shipping rates from EasyPost
        const rates = await getShippingRates(toAddress, fromAddress, {
          length: parcel.length || 1, // Minimum 1 inch
          width: parcel.width || 1,
          height: parcel.height || 1,
          weight: parcel.weight || 1, // Minimum 1 ounce
        });

        return {
          storeId,
          storeName: storeInfo.name,
          rates: rates || [],
          parcel,
        };
      })
    );

    return {
      success: true,
      rates: ratesByStore.filter((r): r is NonNullable<typeof r> => r !== null),
    };
  } catch (error) {
    console.error("Error getting shipping rates:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get shipping rates",
    };
  }
}

/**
 * Get shipping rates for draft order items
 */
export async function getShippingRatesForDraftOrder(
  items: Array<{
    listingId: string;
    variantId: string | null;
    quantity: number;
  }>,
  toAddress: Address,
  storeId: string
): Promise<{
  success: boolean;
  rates?: ShippingRate[];
  parcel?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  error?: string;
}> {
  try {
    // Get store information
    const storeInfo = await db
      .select({
        id: store.id,
        name: store.name,
        addressLine1: store.addressLine1,
        addressLine2: store.addressLine2,
        city: store.city,
        region: store.region,
        postalCode: store.postalCode,
        country: store.country,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeInfo.length === 0) {
      return { success: false, error: "Store not found" };
    }

    const store = storeInfo[0];

    // Get variant IDs
    const variantIds = items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== null);

    // Get inventory items with weight and dimensions
    const inventoryData = await db
      .select({
        variantId: inventoryItems.variantId,
        weightOz: inventoryItems.weightOz,
        lengthIn: inventoryItems.lengthIn,
        widthIn: inventoryItems.widthIn,
        heightIn: inventoryItems.heightIn,
      })
      .from(inventoryItems)
      .where(inArray(inventoryItems.variantId, variantIds));

    const inventoryMap = new Map(
      inventoryData.map((inv) => [inv.variantId, inv])
    );

    // Calculate parcel dimensions
    const parcelItems = items
      .map((item) => {
        const inventory = item.variantId
          ? inventoryMap.get(item.variantId)
          : null;
        return {
          weightOz: inventory?.weightOz ? parseFloat(inventory.weightOz) : 0,
          lengthIn: inventory?.lengthIn ? parseFloat(inventory.lengthIn) : 0,
          widthIn: inventory?.widthIn ? parseFloat(inventory.widthIn) : 0,
          heightIn: inventory?.heightIn ? parseFloat(inventory.heightIn) : 0,
          quantity: item.quantity,
        };
      })
      .filter((item) => item.weightOz > 0);

    if (parcelItems.length === 0) {
      return {
        success: true,
        rates: [],
        parcel: { length: 0, width: 0, height: 0, weight: 0 },
      };
    }

    const parcel = calculateParcelFromItems(parcelItems);

    // Build from address from store info
    const fromAddress: Address = {
      name: store.name,
      street1: store.addressLine1 || "",
      street2: store.addressLine2 || undefined,
      city: store.city || "",
      state: store.region || "",
      zip: store.postalCode || "",
      country: store.country || "US",
    };

    // Get shipping rates from EasyPost
    const rates = await getShippingRates(toAddress, fromAddress, {
      length: parcel.length || 1,
      width: parcel.width || 1,
      height: parcel.height || 1,
      weight: parcel.weight || 1,
    });

    return {
      success: true,
      rates: rates || [],
      parcel,
    };
  } catch (error) {
    console.error("Error getting shipping rates for draft order:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get shipping rates",
    };
  }
}
```

### 6. **Update Checkout Page to Show Shipping Rates**

Update `app/[locale]/checkout/page.tsx` to implement the global shipping option selection flow:

**Checkout Flow:**

1. **Customer enters shipping address**
   - When shipping address is complete, calculate rates internally

2. **Calculate shipping rates for each vendor internally**
   - Combine all items per vendor
   - Get rates from EasyPost for each vendor's shipment
   - Store rates grouped by vendor (not shown to customer yet)

3. **Choose a shipping option globally**
   - Customer selects a shipping option (e.g., "Standard shipping", "Express", "Economy")
   - This selection applies to ALL vendors
   - Behind the scenes, pick the corresponding rate from each vendor that matches the selected service level

4. **Sum up rates to show a single total**
   - Display to customer: "Shipping: €12.50 (Ships from 2 vendors)"
   - Show vendor count but not individual vendor rates

5. **Create order with selected rate IDs**
   - Save each vendor's shipment rate ID in the backend
   - Store these for `Shipment.buy()` later (after payment)

**Key changes needed:**

```typescript
// Add state for shipping rates
const [shippingRatesByVendor, setShippingRatesByVendor] = useState<
  {
    storeId: string;
    storeName: string;
    rates: ShippingRate[];
  }[]
>([]);

// State for global shipping option selection
const [selectedShippingService, setSelectedShippingService] = useState<
  string | null
>(null);
const [totalShipping, setTotalShipping] = useState(0);
const [vendorCount, setVendorCount] = useState(0);

// Fetch rates when shipping address is complete
useEffect(() => {
  if (shippingData.address && shippingData.city && shippingData.country) {
    fetchShippingRates();
  }
}, [shippingData, items]);

// Function to fetch rates (internal calculation)
const fetchShippingRates = async () => {
  const result = await getShippingRatesForOrder(
    items.map((item) => ({
      listingId: item.listingId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      storeId: item.storeId, // You'll need to add storeId to cart items
    })),
    {
      name: `${shippingData.firstName} ${shippingData.lastName}`,
      street1: shippingData.address,
      street2: shippingData.address2,
      city: shippingData.city,
      state: shippingData.state,
      zip: shippingData.zip,
      country: shippingData.country,
    }
  );

  if (result.success && result.rates) {
    setShippingRatesByVendor(result.rates);
    setVendorCount(result.rates.length);

    // Extract unique service levels from all vendors
    const allServices = new Set<string>();
    result.rates.forEach((vendor) => {
      vendor.rates.forEach((rate) => {
        allServices.add(rate.service);
      });
    });

    // Default to first available service (e.g., "Priority" or "Standard")
    const defaultService = Array.from(allServices)[0];
    setSelectedShippingService(defaultService);
    calculateTotalShipping(defaultService, result.rates);
  }
};

// Calculate total shipping based on selected service
const calculateTotalShipping = (
  service: string,
  ratesByVendor: typeof shippingRatesByVendor
) => {
  let total = 0;
  ratesByVendor.forEach((vendor) => {
    // Find rate matching the selected service for this vendor
    const matchingRate = vendor.rates.find((r) => r.service === service);
    if (matchingRate) {
      total += parseFloat(matchingRate.rate);
    }
  });
  setTotalShipping(total);
};

// Handle service selection change
const handleShippingServiceChange = (service: string) => {
  setSelectedShippingService(service);
  calculateTotalShipping(service, shippingRatesByVendor);
};

// Get selected rate IDs for order creation
const getSelectedRateIds = () => {
  return shippingRatesByVendor.map((vendor) => {
    const selectedRate = vendor.rates.find(
      (r) => r.service === selectedShippingService
    );
    return {
      storeId: vendor.storeId,
      rateId: selectedRate?.id || "",
      carrier: selectedRate?.carrier || "",
      service: selectedRate?.service || "",
      rate: selectedRate?.rate || "0",
    };
  });
};
```

**UI Display:**

```typescript
// Show shipping options (not per vendor, but globally)
<div>
  <label>Shipping Method</label>
  <select
    value={selectedShippingService || ""}
    onChange={(e) => handleShippingServiceChange(e.target.value)}
  >
    {Array.from(new Set(
      shippingRatesByVendor.flatMap((v) => v.rates.map((r) => r.service))
    )).map((service) => (
      <option key={service} value={service}>
        {service}
      </option>
    ))}
  </select>

  <div>
    Shipping: €{totalShipping.toFixed(2)} (Ships from {vendorCount} vendor{vendorCount !== 1 ? 's' : ''})
  </div>
</div>
```

### 7. **Update Order Creation to Store Shipping Rate Info**

Update `app/api/checkout/create-order/route.ts` to accept and store shipping rate information:

**Important**: Store per-vendor shipping rate IDs so vendors can purchase labels after payment.

```typescript
interface CreateOrderRequest {
  // ... existing fields ...
  shippingAmount: string;
  shippingMethod?: string | null; // Global service name (e.g., "Standard shipping")
  shippingService?: string | null; // Service level (e.g., "Priority", "Express")
  // Per-vendor shipping selections (required for label purchase)
  vendorShippingRates: Array<{
    storeId: string;
    rateId: string; // EasyPost rate ID - used for Shipment.buy() later
    carrier: string;
    service: string;
    rate: string;
  }>;
}

// In the order creation logic, store per-vendor rate info:
// Option 1: Store in a separate table (recommended for multi-vendor orders)
await tx.insert(orderShippingRates).values(
  body.vendorShippingRates.map((vendorRate) => ({
    orderId: orderId,
    storeId: vendorRate.storeId,
    rateId: vendorRate.rateId,
    carrier: vendorRate.carrier,
    service: vendorRate.service,
    rate: vendorRate.rate,
  }))
);

// Option 2: Store in orders table (if single vendor per order)
// For multi-vendor orders, you'll need a junction table
await tx.insert(orders).values({
  // ... existing fields ...
  shippingAmount: body.shippingAmount,
  shippingMethod: body.shippingMethod || null,
  shippingService: body.shippingService || null,
  // ... rest of fields ...
});
```

**Schema Addition for Order Shipping Rates:**

```typescript
// Add to db/schema.ts
export const orderShippingRates = pgTable("order_shipping_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  rateId: text("rate_id").notNull(), // EasyPost rate ID
  carrier: text("carrier").notNull(),
  service: text("service").notNull(),
  rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 8. **After Payment: Buy Shipments Per Vendor**

After payment is confirmed, vendors can purchase shipping labels using the stored rate IDs.

**Create `app/[locale]/actions/purchase-shipping-labels.ts`:**

```typescript
"use server";

import { db } from "@/db";
import { orders, orderShippingRates, fulfillments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { purchaseShipmentWithRate, type Address } from "@/lib/easypost";
import { nanoid } from "nanoid";
import { updateOrderFulfillmentStatus } from "./orders-fulfillment-utils";

/**
 * Purchase shipping label for a vendor's portion of an order
 * Called after payment is confirmed
 */
export async function purchaseVendorShippingLabel(
  orderId: string,
  storeId: string
): Promise<{
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  error?: string;
}> {
  try {
    // Get order shipping rate for this vendor
    const shippingRate = await db
      .select()
      .from(orderShippingRates)
      .where(
        and(
          eq(orderShippingRates.orderId, orderId),
          eq(orderShippingRates.storeId, storeId)
        )
      )
      .limit(1);

    if (shippingRate.length === 0) {
      return { success: false, error: "Shipping rate not found" };
    }

    // Get order and store addresses
    const order = await db
      .select({
        shippingAddressLine1: orders.shippingAddressLine1,
        shippingAddressLine2: orders.shippingAddressLine2,
        shippingCity: orders.shippingCity,
        shippingRegion: orders.shippingRegion,
        shippingPostalCode: orders.shippingPostalCode,
        shippingCountry: orders.shippingCountry,
        shippingName: orders.shippingName,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (order.length === 0) {
      return { success: false, error: "Order not found" };
    }

    // Get store address
    const storeInfo = await db
      .select({
        name: store.name,
        addressLine1: store.addressLine1,
        addressLine2: store.addressLine2,
        city: store.city,
        region: store.region,
        postalCode: store.postalCode,
        country: store.country,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeInfo.length === 0) {
      return { success: false, error: "Store not found" };
    }

    const orderData = order[0];
    const store = storeInfo[0];

    // Build addresses
    const toAddress: Address = {
      name: orderData.shippingName || "",
      street1: orderData.shippingAddressLine1 || "",
      street2: orderData.shippingAddressLine2 || undefined,
      city: orderData.shippingCity || "",
      state: orderData.shippingRegion || "",
      zip: orderData.shippingPostalCode || "",
      country: orderData.shippingCountry || "US",
    };

    const fromAddress: Address = {
      name: store.name,
      street1: store.addressLine1 || "",
      street2: store.addressLine2 || undefined,
      city: store.city || "",
      state: store.region || "",
      zip: store.postalCode || "",
      country: store.country || "US",
    };

    // Note: You'll need to retrieve the shipment ID from EasyPost
    // This requires storing shipment IDs when rates are calculated
    // For now, this is a placeholder - you may need to recreate the shipment
    // or store shipment IDs in orderShippingRates table

    // Purchase label using stored rate ID
    // This requires the shipment ID - you may need to store this when calculating rates
    // const shipmentInfo = await purchaseShipmentWithRate(shipmentId, shippingRate[0].rateId);

    // For MVP: This function should be called by vendors manually after payment
    // The vendor will use the fulfillOrderVendor function which handles label purchase

    return {
      success: false,
      error: "Label purchase should be done via vendor fulfillment flow",
    };
  } catch (error) {
    console.error("Error purchasing shipping label:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to purchase shipping label",
    };
  }
}
```

**Note**: In practice, label purchase happens when vendors fulfill orders using `fulfillOrderVendor()` function, which already supports EasyPost shipment creation.

### 9. **Display Combined Tracking Info**

**Tracking Flow After Payment:**

1. **Generate unique tracking token for the order**
   - When order is created (or when first vendor ships)
   - Save in `orders.trackingToken` field
   - This token links to the "track order" page

2. **First vendor ships:**
   - Vendor buys the label using `fulfillOrderVendor()` function
   - Gets tracking number from EasyPost
   - Update `fulfillments` table for that vendor's items with:
     - `trackingNumber`
     - `carrier`
     - `fulfilledAt`
     - `vendorFulfillmentStatus: "fulfilled"`
   - **Send a single shipping email** to the customer with the tracking page link
   - Generate tracking token if it doesn't exist

3. **Other vendors have not shipped yet:**
   - Their items remain `vendorFulfillmentStatus: "unfulfilled"` (or "pending")
   - On the tracking page, show clear message: "Vendor X: Not shipped yet"

4. **When subsequent vendors ship:**
   - Update their fulfillment info in the database
   - **Customer doesn't need a new email** — they just refresh the tracking page to see updated tracking info from each vendor

**Update `app/[locale]/actions/orders-fulfillment.ts`:**

The `fulfillOrderVendor()` function already handles this. Add email sending:

```typescript
// In fulfillOrderVendor function, after creating fulfillment:
if (fulfillmentRecord) {
  // Check if this is the first vendor to ship
  const allFulfillments = await tx
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, input.orderId));

  const isFirstVendor = allFulfillments.length === 1;

  if (isFirstVendor) {
    // Generate tracking token if it doesn't exist
    if (!order[0].trackingToken) {
      const trackingToken = nanoid(32);
      await tx
        .update(orders)
        .set({ trackingToken })
        .where(eq(orders.id, input.orderId));
    }

    // Get order customer info
    const orderInfo = await tx
      .select({
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        orderNumber: orders.orderNumber,
        trackingToken: orders.trackingToken,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderInfo.length > 0 && orderInfo[0].customerEmail) {
      // Send tracking notification email
      const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${orderInfo[0].trackingToken}`;

      await sendTrackingNotificationEmail({
        to: orderInfo[0].customerEmail,
        orderNumber: orderInfo[0].orderNumber,
        customerName:
          `${orderInfo[0].customerFirstName || ""} ${orderInfo[0].customerLastName || ""}`.trim() ||
          "Customer",
        trackingUrl: trackingUrl,
        carrier: carrier,
        trackingNumber: trackingNumber,
      });
    }
  }
  - Subsequent vendors: No email sent, customer checks same tracking page for realtime update
}
```

**Update Tracking Page to Show Vendor Status:**

Update `app/[locale]/track/[token]/TrackingPageClient.tsx`:

```typescript
// Show vendor status for unfulfilled vendors
{trackingData.shipments.map((shipment, index) => (
  <Card key={shipment.id} className="p-6">
    {/* ... existing shipment display ... */}

    {!shipment.trackingNumber && (
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>{shipment.carrier || "Vendor"}:</strong> Not shipped yet
        </p>
      </div>
    )}
  </Card>
))}
```

### 10. **Update Draft Order Creation Form**

Update `app/[locale]/dashboard/orders/components/CreateOrderForm.tsx` to:

1. Add shipping rate calculation when items and address are entered
2. Display shipping rate options
3. Allow admin/seller to select carrier and service
4. Store selected shipping rate information

**Key additions:**

```typescript
// Add state for shipping rates
const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
const [selectedShippingRateId, setSelectedShippingRateId] = useState<
  string | null
>(null);
const [isLoadingRates, setIsLoadingRates] = useState(false);

// Function to fetch shipping rates
const fetchShippingRates = async () => {
  if (
    lineItems.length === 0 ||
    !shippingAddressLine1 ||
    !shippingCity ||
    !shippingCountry
  ) {
    return;
  }

  setIsLoadingRates(true);
  const result = await getShippingRatesForDraftOrder(
    lineItems.map((item) => ({
      listingId: item.listingId,
      variantId: item.variantId || null,
      quantity: item.quantity,
    })),
    {
      name: shippingName || "",
      street1: shippingAddressLine1,
      street2: shippingAddressLine2 || undefined,
      city: shippingCity,
      state: shippingRegion || "",
      zip: shippingPostalCode || "",
      country: shippingCountry,
    },
    storeId // Get from context or props
  );

  if (result.success && result.rates) {
    setShippingRates(result.rates);
    if (result.rates.length > 0) {
      setSelectedShippingRateId(result.rates[0].id);
      // Auto-update shipping amount
      const selectedRate = result.rates[0];
      setShippingAmount(parseFloat(selectedRate.rate).toFixed(2));
    }
  }
  setIsLoadingRates(false);
};

// Call fetchShippingRates when address or items change
useEffect(() => {
  fetchShippingRates();
}, [lineItems, shippingAddressLine1, shippingCity, shippingCountry]);
```

### 11. **Update Product Form for Weight & Dimensions Input**

Update `app/[locale]/dashboard/components/shared/ProductForm.tsx` to:

1. Add weight input with unit selector (OZ/KG)
2. Add dimensions inputs with unit selector (IN/CM)
3. Convert and store in database as OZ and IN

**Key additions:**

```typescript
// Add to form state
const [weightUnit, setWeightUnit] = useState<"oz" | "kg">("kg");
const [dimensionUnit, setDimensionUnit] = useState<"in" | "cm">("cm");
const [weightValue, setWeightValue] = useState<number | "">("");
const [lengthValue, setLengthValue] = useState<number | "">("");
const [widthValue, setWidthValue] = useState<number | "">("");
const [heightValue, setHeightValue] = useState<number | "">("");

// Conversion functions
import { kilogramsToOunces, centimetersToInches } from "@/lib/shipping-utils";

// On submit, convert and save
const weightOz =
  weightUnit === "kg"
    ? kilogramsToOunces(parseFloat(weightValue.toString()) || 0)
    : parseFloat(weightValue.toString()) || 0;

const lengthIn =
  dimensionUnit === "cm"
    ? centimetersToInches(parseFloat(lengthValue.toString()) || 0)
    : parseFloat(lengthValue.toString()) || 0;

// Similar for width and height
```

### 12. **Update Inventory Items Creation/Update**

When creating or updating inventory items, ensure weight and dimensions are saved:

```typescript
// In your inventory item creation/update action
await db.insert(inventoryItems).values({
  variantId: variantId,
  weightOz: weightOz.toString(),
  lengthIn: lengthIn.toString(),
  widthIn: widthIn.toString(),
  heightIn: heightIn.toString(),
  // ... other fields ...
});
```

## Summary

**Schema Modifications Required:**

1. ✅ **`inventoryItems` table:**
   - Add `weightOz` (numeric 8,1) - weight in ounces
   - Add `lengthIn`, `widthIn`, `heightIn` (numeric 8,1) - dimensions in inches
   - Migrate existing `weightGrams` to `weightOz` or keep both

2. ✅ **`orders` table:**
   - Add `shippingCarrier` (text) - selected carrier
   - Add `shippingService` (text) - service level
   - Add `shippingRateId` (text) - EasyPost rate ID

3. ✅ **`draftOrders` table:**
   - Add `shippingCarrier` (text) - selected carrier
   - Add `shippingService` (text) - service level
   - Add `shippingRateId` (text) - EasyPost rate ID

4. ✅ **`orderShippingRates` table (NEW):**
   - Create new table to store per-vendor shipping rate selections
   - Fields: `id`, `orderId`, `storeId`, `rateId`, `carrier`, `service`, `rate`, `createdAt`
   - This allows storing multiple rate IDs for multi-vendor orders

**Files to Create:**

1. `lib/shipping-utils.ts` - Unit conversion utilities
2. `app/[locale]/actions/shipping-rates.ts` - Shipping rate calculation actions

**Files to Update:**

1. `lib/easypost.ts` - Add `getShippingRates()` and `purchaseShipmentWithRate()`
2. `app/[locale]/checkout/page.tsx` - Add shipping rate selection UI
3. `app/api/checkout/create-order/route.ts` - Store shipping rate info
4. `app/[locale]/dashboard/orders/components/CreateOrderForm.tsx` - Add shipping rate selection
5. `app/[locale]/dashboard/components/shared/ProductForm.tsx` - Add weight/dimensions input with unit conversion
6. Inventory item creation/update actions - Save weight and dimensions

**Key Implementation Notes:**

- **Weight**: Stored in OZ (1 decimal), UI supports KG input with conversion
- **Dimensions**: Stored in IN (1 decimal), UI supports CM input with conversion
- **Multi-vendor**: Each vendor's items calculated separately, rates calculated internally per vendor
- **Checkout Flow**:
  - Customer enters shipping address
  - System calculates rates for each vendor internally
  - Customer selects ONE global shipping option (e.g., "Standard shipping")
  - System picks corresponding rate from each vendor matching the selected service
  - Display: "Shipping: €12.50 (Ships from 2 vendors)" - single total, vendor count shown
  - Store each vendor's rate ID for label purchase after payment
- **After Payment**:
  - Vendors purchase labels using stored rate IDs via `fulfillOrderVendor()`
  - Each vendor gets a label and tracking number
- **Tracking**:
  - Generate unique tracking token when order is created (or first vendor ships)
  - First vendor ships: Send single shipping email with tracking page link
  - Other vendors: Show "Vendor X: Not shipped yet" on tracking page
  - Subsequent vendors: Customer refreshes tracking page to see updates (no new email)
- **Draft orders**: Admin/seller can select carrier and service, rate is calculated and stored
- **Order creation**: Selected shipping rate IDs stored in `orderShippingRates` table for later label purchase

Review and approve schema changes
Create database migration
Implement updateSellerBalance() helper
Update checkout to remove transfers
Update webhook to create ledger entries
Add shipping label deduction
Build payout request system
Create seller payout dashboard
Test thoroughly

Admin-side controls (Etsy has these internally)

You should build admin-only tools:

- Override payout delay
- Manually hold seller funds
- Force early payout
- View seller ledger
- Freeze payouts during disputes

2026-01-09 22:30:50.659 [error] [Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.] {
digest: 'DYNAMIC_SERVER_USAGE'
}
2026-01-09 22:30:50.661 [error] ⨯ [Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.] {
digest: 'DYNAMIC_SERVER_USAGE',
page: '/en'
}
2026-01-09 22:30:50.662 [error] ⨯ Error: Failed to load static file for page: /500 ENOENT: no such file or directory, open '/var/task/.next/server/pages/500.html'
at async Object.handler (\_\_\_next_launcher.cjs:57:3)
2026-01-09 22:30:50.662 [error] [Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.] {
digest: 'DYNAMIC_SERVER_USAGE',
page: '/en'
}
2026-01-09 22:30:50.663 [error] [Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.] {
digest: 'DYNAMIC_SERVER_USAGE',
page: '/en'
}
