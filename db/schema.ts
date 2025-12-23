import { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  uuid,
  serial,
  primaryKey,
  pgEnum,
  jsonb,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",
  "suspended",
]);

export const marketTypeEnum = pgEnum("market_type", ["local", "international"]);

export const marketStatusEnum = pgEnum("market_status", ["active", "draft"]);

export const inventoryEventTypeEnum = pgEnum("inventory_event_type", [
  "reserve",
  "release",
  "fulfill",
  "ship",
  "restock",
  "adjustment",
  "return",
  "damage",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "amount_off_products",
]);

export const discountValueTypeEnum = pgEnum("discount_value_type", [
  "fixed",
  "percentage",
]);

export const discountTargetTypeEnum = pgEnum("discount_target_type", [
  "all_products",
  "product_ids",
]);

export const customerEligibilityTypeEnum = pgEnum("customer_eligibility_type", [
  "all",
  "specific",
]);

// Shopify-style status enum: active | draft | archived
export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "draft",
  "archived",
]);

// Order status enums
export const orderPaymentStatusEnum = pgEnum("order_payment_status", [
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
  "void",
]);

export const orderFulfillmentStatusEnum = pgEnum("order_fulfillment_status", [
  "unfulfilled",
  "partial",
  "fulfilled",
  "canceled",
]);

// Workflow status (operational flags, per inst.md)
export const orderWorkflowStatusEnum = pgEnum("order_workflow_status", [
  "normal",
  "in_progress",
  "on_hold",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "open",
  "draft",
  "archived",
  "canceled",
  "completed",
]);

export const storeMemberRoleEnum = pgEnum("store_member_role", [
  "admin",
  "seller",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  status: userStatusEnum("status").default("pending").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  image: text("image"),
  marketId: uuid("market_id").references(() => markets.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // "Admin", "Seller", "Customer"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(), // e.g. "manage_users"
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: text("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    roleId: integer("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// 2️⃣ Category Rules table - stores documentation requirements for taxonomy categories
export const categoryRules = pgTable("category_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  taxonomyCategoryId: text("taxonomy_category_id").notNull().unique(),
  requiresDocumentation: boolean("requires_documentation")
    .default(false)
    .notNull(),
  documentationDescription: text("documentation_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Documentation tables
export const documentationType = pgTable("documentation_type", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // e.g., "Food Safety License"
  description: text("description"),
  exampleUrl: text("example_url"), // optional sample file for reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Category Rules Documentation - links documentation types to taxonomy categories
export const categoryRulesDocumentation = pgTable(
  "category_rules_documentation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryRuleId: uuid("category_rule_id")
      .notNull()
      .references(() => categoryRules.id, { onDelete: "cascade" }),
    documentationTypeId: uuid("documentation_type_id")
      .notNull()
      .references(() => documentationType.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export const sellerDocumentation = pgTable(
  "seller_documentation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentationTypeId: uuid("documentation_type_id")
      .notNull()
      .references(() => documentationType.id, { onDelete: "cascade" }),
    documentUrl: text("document_url").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    status: text("status").default("pending"), // pending | approved | rejected
    submittedAt: timestamp("submitted_at").defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("unique_seller_doc").on(table.sellerId, table.documentationTypeId),
  ]
);

//////////////////////////////////////////////////////////
// LISTING (Base table in English)
//////////////////////////////////////////////////////////

export const listing = pgTable("listing", {
  id: uuid("id").primaryKey(), // unique listing ID
  producerId: text("producer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Basic product info
  name: text("name").notNull(), // e.g. "Himalayan Mad Honey"
  description: text("description"),
  storeId: uuid("store_id")
    .references(() => store.id, {
      onDelete: "set null",
    })
    .notNull(), // Reference to store table
  categoryRuleId: uuid("category_rule_id").references(() => categoryRules.id, {
    onDelete: "set null",
  }), // Optional - only required if category has documentation rules
  taxonomyCategoryId: text("taxonomy_category_id"), // Taxonomy category ID from JSON file
  taxonomyCategoryName: text("taxonomy_category_name"), // Short name (e.g., "Honey") for display
  imageUrl: text("image_url"),
  gallery: text("gallery").array(),
  tags: text("tags").array(),

  // Pricing
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", {
    precision: 10,
    scale: 2,
  }), // Optional compare-at price
  currency: text("currency").default("NPR").notNull(),
  unit: text("unit").default("kg"),

  // Status & visibility (Shopify-style)
  status: listingStatusEnum("status").default("draft"),
  isFeatured: boolean("is_featured").default(false),
  marketType: marketTypeEnum("market_type").default("local"),

  // Published at (when it became active)
  publishedAt: timestamp("published_at"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Optional metadata
  ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).default(
    "0"
  ),
  ratingCount: integer("rating_count").default(0),
  salesCount: integer("sales_count").default(0),
  originVillage: text("origin_village"),
  harvestDate: timestamp("harvest_date"),
});

//////////////////////////////////////////////////////////
// LISTING TRANSLATIONS TABLE
//////////////////////////////////////////////////////////

export const listingTranslations = pgTable("listing_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listing.id, { onDelete: "cascade" }),

  // Locale code (e.g. 'en', 'fi', 'ne')
  locale: varchar("locale", { length: 10 }).notNull(),

  // Translatable fields
  name: text("name"),
  description: text("description"),
  tags: text("tags").array(),

  // Optional localized metadata
  originVillage: text("origin_village"),
});

// ===================================
// MARKETS
// ===================================
export const markets = pgTable("markets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // "Europe", "United States"
  currency: text("currency").notNull(), // "EUR", "USD"
  countries: jsonb("countries").$type<string[]>(), // Array of country codes
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("1"), // Relative to base currency (EUR)
  roundingRule: text("rounding_rule").default("none"), // "none" | "0.99" | "nearest_0.05"
  status: marketStatusEnum("status").default("active").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }), // User who created this market
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// STORE (formerly vendor)
// ===================================
export const store = pgTable("store", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeName: text("store_name").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  storeCurrency: text("store_currency").notNull().default("EUR"),
  unitSystem: text("unit_system").notNull().default("Metric system"), // "Metric system" | "Imperial system"
  stripeAccountId: text("stripe_account_id"), // Stripe Connect account ID
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(
    false
  ), // Track if onboarding is complete
  stripeChargesEnabled: boolean("stripe_charges_enabled").default(false), // Track if charges are enabled
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false), // Track if payouts are enabled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// STORE MEMBERS
// ===================================
export const storeMembers = pgTable("store_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: storeMemberRoleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// LISTING VARIANTS
// ===================================
export const listingVariants = pgTable("listing_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listing.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Example: "500g / Premium"
  sku: text("sku"),
  price: numeric("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }), // EUR, USD, NPR
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  // For multiple options (size, weight, gram, color)
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Listing Variants Translations
export const listingVariantTranslations = pgTable(
  "listing_variant_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => listingVariants.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    title: text("title"),
  }
);

// ===================================
// INVENTORY ITEMS
// ===================================
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => listingVariants.id, { onDelete: "cascade" }),
  costPerItem: numeric("cost_per_item", { precision: 10, scale: 2 }).default(
    "0"
  ),
  requiresShipping: boolean("requires_shipping").default(true),
  weightGrams: integer("weight_grams").default(0),
  countryOfOrigin: text("country_of_origin"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// INVENTORY LOCATIONS
// ===================================
export const inventoryLocations = pgTable("inventory_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Kathmandu Warehouse"
  address: text("address"),
  phone: text("phone"), // Phone / contact (optional)
  fulfillmentRules: text("fulfillment_rules"), // Fulfillment rules (optional)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Inventory Locations Translations
export const inventoryLocationTranslations = pgTable(
  "inventory_location_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    name: text("name"),
    address: text("address"),
  }
);

// ===================================
// INVENTORY LEVELS
// ===================================
export const inventoryLevels = pgTable("inventory_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  locationId: uuid("location_id")
    .notNull()
    .references(() => inventoryLocations.id, { onDelete: "cascade" }),
  available: integer("available").default(0),
  committed: integer("committed").default(0),
  incoming: integer("incoming").default(0),
  onHand: integer("on_hand").default(0), // available + committed (physical stock)
  shipped: integer("shipped").default(0), // total shipped quantity (historical)
  damaged: integer("damaged").default(0), // damaged/lost items
  returned: integer("returned").default(0), // returned items
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// CUSTOMERS
// ===================================
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id").references(() => store.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }), // optional link to auth user
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    // Optional default address snapshot
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("customers_store_id_email_unique").on(table.storeId, table.email),
  ]
);

// ===================================
// ORDERS
// ===================================
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Human-friendly incremental number, e.g. 1001, 1002
  orderNumber: serial("order_number").notNull(), // Use this as "order_id" in UI

  storeId: uuid("store_id").references(() => store.id, {
    onDelete: "set null",
  }),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),

  // Market snapshot (at transaction time)
  marketId: uuid("market_id").references(() => markets.id, {
    onDelete: "set null",
  }),

  // Customer snapshot (denormalized)
  customerEmail: text("customer_email"),
  customerFirstName: text("customer_first_name"),
  customerLastName: text("customer_last_name"),

  // Currency and totals
  currency: text("currency").notNull(), // reuse 'EUR' | 'USD' | 'NPR'
  subtotalAmount: numeric("subtotal_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discountTotal: numeric("discount_total", { precision: 10, scale: 2 })
    .default("0")
    .notNull(), // Sum of order_discounts.amount (source of truth)
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  refundedAmount: numeric("refunded_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),

  // Statuses
  status: orderStatusEnum("status").default("open").notNull(),
  paymentStatus: orderPaymentStatusEnum("payment_status")
    .default("pending")
    .notNull(),
  fulfillmentStatus: orderFulfillmentStatusEnum("fulfillment_status")
    .default("unfulfilled")
    .notNull(),

  // Workflow status (operational flags, per inst.md)
  workflowStatus: orderWorkflowStatusEnum("workflow_status")
    .default("normal")
    .notNull(),
  holdReason: text("hold_reason"), // Reason for on_hold status

  // Shipping & billing snapshots (flat fields for now)
  shippingName: text("shipping_name"),
  shippingPhone: text("shipping_phone"),
  shippingAddressLine1: text("shipping_address_line_1"),
  shippingAddressLine2: text("shipping_address_line_2"),
  shippingCity: text("shipping_city"),
  shippingRegion: text("shipping_region"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingCountry: text("shipping_country"),

  billingName: text("billing_name"),
  billingPhone: text("billing_phone"),
  billingAddressLine1: text("billing_address_line_1"),
  billingAddressLine2: text("billing_address_line_2"),
  billingCity: text("billing_city"),
  billingRegion: text("billing_region"),
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country"),

  // Meta
  notes: text("notes"), // Public notes (visible to customer)
  internalNote: text("internal_note"), // Internal notes (seller/admin only)
  tags: text("tags"), // comma-separated for now
  shippingMethod: text("shipping_method"), // Shipping method name

  // Important timestamps
  placedAt: timestamp("placed_at").defaultNow(), // when the order is placed
  paidAt: timestamp("paid_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  canceledAt: timestamp("canceled_at"),
  archivedAt: timestamp("archived_at"), // When order was archived

  // Invoice fields
  invoiceNumber: text("invoice_number"), // Sequential invoice number (INV-2025-000431)
  invoiceIssuedAt: timestamp("invoice_issued_at"), // When invoice was issued
  invoiceLockedAt: timestamp("invoice_locked_at"), // When financials were locked
  invoicePdfUrl: text("invoice_pdf_url"), // Cloudinary URL for invoice PDF
  invoicePublicId: text("invoice_public_id"), // Cloudinary public_id for generating signed URLs
  invoiceToken: text("invoice_token").unique(), // Secure token for payment link
  invoiceExpiresAt: timestamp("invoice_expires_at"), // Token expiration (e.g., 30 days)
  invoiceSentAt: timestamp("invoice_sent_at"), // Track when invoice was sent
  invoiceSentCount: integer("invoice_sent_count").default(0), // How many times sent

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// DRAFT ORDERS
// ===================================
export const draftOrders = pgTable("draft_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftNumber: serial("draft_number").notNull(), // Sequential number for drafts (#D1, #D2, etc.)

  storeId: uuid("store_id").references(() => store.id, {
    onDelete: "set null",
  }),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),

  // Customer snapshot (denormalized)
  customerEmail: text("customer_email"),
  customerFirstName: text("customer_first_name"),
  customerLastName: text("customer_last_name"),

  // Market snapshot (at transaction time)
  marketId: uuid("market_id").references(() => markets.id, {
    onDelete: "set null",
  }),

  // Currency and totals
  currency: text("currency").notNull(), // reuse 'EUR' | 'USD' | 'NPR'
  subtotalAmount: numeric("subtotal_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),

  // Payment status (drafts don't have order status or fulfillment status)
  paymentStatus: orderPaymentStatusEnum("payment_status")
    .default("pending")
    .notNull(),

  // Shipping & billing snapshots (flat fields for now)
  shippingName: text("shipping_name"),
  shippingPhone: text("shipping_phone"),
  shippingAddressLine1: text("shipping_address_line_1"),
  shippingAddressLine2: text("shipping_address_line_2"),
  shippingCity: text("shipping_city"),
  shippingRegion: text("shipping_region"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingCountry: text("shipping_country"),

  billingName: text("billing_name"),
  billingPhone: text("billing_phone"),
  billingAddressLine1: text("billing_address_line_1"),
  billingAddressLine2: text("billing_address_line_2"),
  billingCity: text("billing_city"),
  billingRegion: text("billing_region"),
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country"),

  // Meta
  notes: text("notes"), // Public notes (visible to customer)
  shippingMethod: text("shipping_method"), // Shipping method name

  // Conversion tracking
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  convertedToOrderId: uuid("converted_to_order_id").references(
    () => orders.id,
    {
      onDelete: "set null",
    }
  ),

  // Invoice tracking
  invoiceToken: text("invoice_token").unique(), // Secure token for payment link
  invoiceExpiresAt: timestamp("invoice_expires_at"), // Token expiration (e.g., 30 days)
  invoiceSentAt: timestamp("invoice_sent_at"), // Track when invoice was sent
  invoiceSentCount: integer("invoice_sent_count").default(0), // How many times sent

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// DRAFT ORDER ITEMS
// ===================================
export const draftOrderItems = pgTable("draft_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftOrderId: uuid("draft_order_id")
    .notNull()
    .references(() => draftOrders.id, { onDelete: "cascade" }),
  listingId: uuid("listing_id").references(() => listing.id, {
    onDelete: "set null",
  }),
  variantId: uuid("variant_id").references(() => listingVariants.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(), // e.g. product name + variant
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  lineSubtotal: numeric("line_subtotal", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// ORDER ITEMS
// ===================================
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  listingId: uuid("listing_id").references(() => listing.id, {
    onDelete: "set null",
  }),
  variantId: uuid("variant_id").references(() => listingVariants.id, {
    onDelete: "set null",
  }),

  // Snapshot at time of order
  title: text("title").notNull(), // e.g. product name + variant
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  lineSubtotal: numeric("line_subtotal", { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice before discounts
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(), // after discounts

  // For future expansion
  discountAmount: numeric("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),

  // Fulfillment tracking (per inst.md)
  fulfilledQuantity: integer("fulfilled_quantity").default(0).notNull(), // How many of this item have been fulfilled

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// ORDER PAYMENTS (Optional for future)
// ===================================
export const orderPayments = pgTable("order_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  provider: text("provider"), // 'stripe', 'paypal', 'cash', etc.
  providerPaymentId: text("provider_payment_id"), // Stripe payment intent ID, etc.
  platformFeeAmount: numeric("platform_fee_amount", {
    precision: 10,
    scale: 2,
  }), // 5% platform fee
  netAmountToStore: numeric("net_amount_to_store", { precision: 10, scale: 2 }), // Amount store receives
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe PaymentIntent ID
  stripeCheckoutSessionId: text("stripe_checkout_session_id"), // Stripe Checkout Session ID
  status: text("status").default("pending"), // completed | partially_refunded | refunded
  refundedAmount: numeric("refunded_amount", { precision: 10, scale: 2 })
    .default("0")
    .notNull(), // Amount refunded from this payment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// ORDER REFUNDS
// ===================================
export const orderRefunds = pgTable("order_refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  orderPaymentId: uuid("order_payment_id")
    .notNull()
    .references(() => orderPayments.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'stripe' | 'manual'
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"), // Refund reason (customer request, damaged, returned, fraud, other)
  stripeRefundId: text("stripe_refund_id"), // Stripe Refund ID (nullable for manual refunds)
  status: text("status").default("pending").notNull(), // pending | succeeded | failed
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Additional refund metadata
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// ORDER REFUND ITEMS
// ===================================
export const orderRefundItems = pgTable("order_refund_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundId: uuid("refund_id")
    .notNull()
    .references(() => orderRefunds.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// FULFILLMENTS
// ===================================
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
  status: text("status").default("pending"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  // Fulfillment metadata (per inst.md)
  carrier: text("carrier"), // UPS, Posti, DHL, etc.
  fulfilledBy: text("fulfilled_by"), // seller / warehouse / automation
  fulfilledAt: timestamp("fulfilled_at"), // When fulfillment occurred
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// INVENTORY ADJUSTMENTS
// ===================================
export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
    { onDelete: "set null" }
  ),
  locationId: uuid("location_id").references(() => inventoryLocations.id, {
    onDelete: "set null",
  }),
  change: integer("change").notNull(), // +10, -3, etc.
  reason: text("reason").default("manual"),
  eventType: inventoryEventTypeEnum("event_type")
    .notNull()
    .default("adjustment"), // 'reserve', 'release', 'fulfill', 'ship', 'restock', 'adjustment', 'return', 'damage'
  referenceType: text("reference_type"), // 'order', 'fulfillment', 'shipment', 'refund', 'manual', 'supplier'
  referenceId: uuid("reference_id"), // ID of the order/fulfillment/etc that caused this change
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===================================
// HOMEPAGE
// ===================================
// Hero section
export const homepageHero = pgTable("homepage_hero", {
  id: uuid("id").defaultRandom().primaryKey(),
  imageUrl: text("image_url").notNull(),
  ctaLink: text("cta_link"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
});

export const homepageHeroTranslations = pgTable("homepage_hero_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  heroId: uuid("hero_id")
    .notNull()
    .references(() => homepageHero.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  ctaLabel: text("cta_label"),
});

// About section
export const homepageAbout = pgTable("homepage_about", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetUrl: text("asset_url"),
  isActive: boolean("is_active").default(true),
});

export const homepageAboutTranslations = pgTable(
  "homepage_about_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aboutId: uuid("about_id")
      .notNull()
      .references(() => homepageAbout.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    title: text("title"),
    content: text("content"),
  }
);

// Benefits section
export const homepageBenefits = pgTable("homepage_benefits", {
  id: uuid("id").defaultRandom().primaryKey(),
  isActive: boolean("is_active").default(true),
});

export const homepageBenefitTranslations = pgTable(
  "homepage_benefit_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    benefitId: uuid("benefit_id")
      .notNull()
      .references(() => homepageBenefits.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    title: text("title"),
    items: jsonb("items").$type<
      {
        icon: string;
        title: string;
        description: string;
      }[]
    >(),
  }
);

// ===================================

// ===================================
// NAVBAR
// ===================================
export const navbar = pgTable("navbar", {
  id: serial("id").primaryKey(),
  logoUrl: varchar("logo_url", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const navbarTranslations = pgTable("navbar_translations", {
  id: serial("id").primaryKey(),
  navbarId: integer("navbar_id")
    .notNull()
    .references(() => navbar.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(), // 'en', 'fi', 'ne'
  title: varchar("title", { length: 200 }).notNull(),
});

export const navbarItems = pgTable("navbar_items", {
  id: serial("id").primaryKey(),
  navbarId: integer("navbar_id")
    .notNull()
    .references(() => navbar.id, { onDelete: "cascade" }),
  href: varchar("href", { length: 255 }).notNull(),
  order: integer("order").default(0),
  requiresAuth: boolean("requires_auth").default(false),
  isVisible: boolean("is_visible").default(true),
});

export const navbarItemTranslations = pgTable("navbar_item_translations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => navbarItems.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
});

// ===================================
// FOOTER
// ===================================
export const footerSections = pgTable("footer_sections", {
  id: serial("id").primaryKey(),
  order: integer("order").default(0),
});

export const footerSectionTranslations = pgTable(
  "footer_section_translations",
  {
    id: serial("id").primaryKey(),
    sectionId: integer("section_id")
      .notNull()
      .references(() => footerSections.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
  }
);

export const footerItems = pgTable("footer_items", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => footerSections.id, { onDelete: "cascade" }),
  href: varchar("href", { length: 255 }),
  icon: varchar("icon", { length: 100 }),
  hasIcon: boolean("has_icon").default(false),
  order: integer("order").default(0),
  listItems: jsonb("list_items").$type<string[]>(),
});

export const footerItemTranslations = pgTable("footer_item_translations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => footerItems.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  text: varchar("text", { length: 255 }),
});

// ===================================
// ABOUT PAGE
// ===================================
export const aboutPage = pgTable("about_page", {
  id: serial("id").primaryKey(),
  metadata: jsonb("metadata").$type<{
    openGraphTitle?: string;
    openGraphDescription?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aboutPageTranslations = pgTable("about_page_translations", {
  id: serial("id").primaryKey(),
  aboutId: integer("about_id")
    .notNull()
    .references(() => aboutPage.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
});

export const aboutSections = pgTable("about_sections", {
  id: serial("id").primaryKey(),
  aboutId: integer("about_id")
    .notNull()
    .references(() => aboutPage.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // e.g. 'hero', 'mission', 'values'
  imageUrl: varchar("image_url", { length: 500 }),
  order: integer("order").default(0),
  isVisible: boolean("is_visible").default(true),
});

export const aboutSectionTranslations = pgTable("about_section_translations", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => aboutSections.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(),
  title: varchar("title", { length: 200 }),
  subtitle: varchar("subtitle", { length: 300 }),
  content: text("content"),
  extraData: jsonb("extra_data").$type<{
    card1Icon?: string;
    card1Title?: string;
    card1Text?: string;
    card2Icon?: string;
    card2Title?: string;
    card2Text?: string;
    card3Icon?: string;
    card3Title?: string;
    card3Text?: string;
  }>(),
});

// Export feedbacks table
export { feedbacks } from "./schema/feedback";

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type Listing = InferSelectModel<typeof listing>;
export type DocumentationType = InferSelectModel<typeof documentationType>;
export type CategoryRules = InferSelectModel<typeof categoryRules>;
export type CategoryRulesDocumentation = InferSelectModel<
  typeof categoryRulesDocumentation
>;
export type SellerDocumentation = InferSelectModel<typeof sellerDocumentation>;
export type Navbar = InferSelectModel<typeof navbar>;
export type NavbarItems = InferSelectModel<typeof navbarItems>;
export type FooterSections = InferSelectModel<typeof footerSections>;
export type FooterItems = InferSelectModel<typeof footerItems>;
export type AboutPage = InferSelectModel<typeof aboutPage>;
export type AboutSections = InferSelectModel<typeof aboutSections>;

// Shipping and Billing Information
export const shippingBillingInfo = pgTable("shipping_billing_info", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(), // One address per user
  // Billing Information
  billingFirstName: text("billing_first_name"),
  billingLastName: text("billing_last_name"),
  billingCompany: text("billing_company"),
  billingCountry: text("billing_country"),
  billingAddress: text("billing_address"),
  billingAddress2: text("billing_address_2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  billingPhone: text("billing_phone"),
  billingEmail: text("billing_email"),
  // Shipping Information
  shippingFirstName: text("shipping_first_name"),
  shippingLastName: text("shipping_last_name"),
  shippingCompany: text("shipping_company"),
  shippingCountry: text("shipping_country"),
  shippingAddress: text("shipping_address"),
  shippingAddress2: text("shipping_address_2"),
  shippingCity: text("shipping_city"),
  shippingState: text("shipping_state"),
  shippingZip: text("shipping_zip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type ShippingBillingInfo = InferSelectModel<typeof shippingBillingInfo>;

// ===================================
// DISCOUNTS
// ===================================
export const discounts = pgTable("discounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: discountTypeEnum("type").notNull(), // "amount_off_products" (extensible later)
  name: varchar("name", { length: 255 }).notNull(), // Internal name
  code: varchar("code", { length: 100 }), // Optional discount code
  valueType: discountValueTypeEnum("value_type").notNull(), // "fixed" | "percentage"
  value: numeric("value", { precision: 10, scale: 2 }).notNull(), // 10 or 15%
  currency: varchar("currency", { length: 3 }), // Needed for fixed discounts

  appliesOncePerOrder: boolean("applies_once_per_order").default(false), // Future-proof
  usageLimit: integer("usage_limit"), // Nullable for unlimited
  usageCount: integer("usage_count").default(0).notNull(),

  // Minimum purchase requirements
  minPurchaseAmount: numeric("min_purchase_amount", {
    precision: 10,
    scale: 2,
  }), // Nullable - no minimum if NULL
  minPurchaseQuantity: integer("min_purchase_quantity"), // Nullable - no minimum if NULL

  // Customer eligibility
  customerEligibilityType: customerEligibilityTypeEnum(
    "customer_eligibility_type"
  )
    .default("all")
    .notNull(), // "all" | "specific"

  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").default(true).notNull(),

  // Ownership (per inst.md)
  ownerType: varchar("owner_type", { length: 20 }).notNull(), // "admin" | "seller"
  ownerId: uuid("owner_id"), // sellerId when ownerType = "seller", null for admin

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// DISCOUNT TARGETS
// ===================================
export const discountTargets = pgTable("discount_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discounts.id, { onDelete: "cascade" }),

  targetType: discountTargetTypeEnum("target_type").notNull(), // "all_products" | "product_ids"
  productIds: jsonb("product_ids").$type<string[]>(), // Array of product IDs (nullable for all_products)

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// DISCOUNT CUSTOMERS (Many-to-Many for Specific Customer Eligibility)
// ===================================
export const discountCustomers = pgTable("discount_customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discounts.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// ORDER DISCOUNTS (Applied Discount - Order Level)
// ===================================
export const orderDiscounts = pgTable("order_discounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  discountId: uuid("discount_id").references(() => discounts.id, {
    onDelete: "restrict",
  }), // Nullable for custom discounts

  code: varchar("code", { length: 100 }), // Snapshot of discount code
  type: varchar("type", { length: 50 }).notNull(), // Snapshot of discount type
  valueType: varchar("value_type", { length: 20 }).notNull(), // Snapshot: "fixed" | "percentage"
  value: numeric("value", { precision: 10, scale: 2 }).notNull(), // Snapshot of discount value

  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Total discount amount applied
  currency: varchar("currency", { length: 3 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// ORDER ITEM DISCOUNTS (Line-Item Allocation)
// ===================================
export const orderItemDiscounts = pgTable("order_item_discounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  orderDiscountId: uuid("order_discount_id")
    .notNull()
    .references(() => orderDiscounts.id, { onDelete: "cascade" }),

  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Discount amount allocated to this line item

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// ORDER EVENTS (Timeline)
// ===================================
export const orderEvents = pgTable("order_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "system" | "payment" | "fulfillment" | "refund" | "email" | "comment"
  visibility: text("visibility").notNull().default("internal"), // "internal" | "customer"
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// TRANSLATIONS
// ===================================
// Type for translation data - nested JSON structure
// Top level keys are strings, values can be strings or nested objects
export type TranslationData = Record<
  string,
  string | Record<string, string | Record<string, string>>
>;

export const translations = pgTable("translations", {
  lang: text("lang").primaryKey(), // 'en', 'fi', 'ne'
  // JSONB stores nested translation objects
  // Type allows string values or nested Record structures
  data: jsonb("data").notNull().$type<TranslationData>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Translations = InferSelectModel<typeof translations>;

// ===================================
// FAQ
// ===================================
export const faqSections = pgTable("faq_sections", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // e.g. "for-sellers", "for-customers"
  order: integer("order").default(0),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const faqSectionTranslations = pgTable("faq_section_translations", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => faqSections.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(), // 'en', 'fi', 'ne'
  title: varchar("title", { length: 200 }).notNull(), // e.g. "For Sellers", "For Customers"
});

export const faqItems = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => faqSections.id, { onDelete: "cascade" }),
  order: integer("order").default(0),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const faqItemTranslations = pgTable("faq_item_translations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => faqItems.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 10 }).notNull(), // 'en', 'fi', 'ne'
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
});

export type FaqSection = InferSelectModel<typeof faqSections>;
export type FaqSectionTranslation = InferSelectModel<
  typeof faqSectionTranslations
>;
export type FaqItem = InferSelectModel<typeof faqItems>;
export type FaqItemTranslation = InferSelectModel<typeof faqItemTranslations>;
export type Store = InferSelectModel<typeof store>;
export type ListingVariant = InferSelectModel<typeof listingVariants>;
export type ListingVariantTranslation = InferSelectModel<
  typeof listingVariantTranslations
>;
export type InventoryItem = InferSelectModel<typeof inventoryItems>;
export type InventoryLocation = InferSelectModel<typeof inventoryLocations>;
export type InventoryLocationTranslation = InferSelectModel<
  typeof inventoryLocationTranslations
>;
export type InventoryLevel = InferSelectModel<typeof inventoryLevels>;
export type Fulfillment = InferSelectModel<typeof fulfillments>;
export type InventoryAdjustment = InferSelectModel<typeof inventoryAdjustments>;
export type Customer = InferSelectModel<typeof customers>;
export type Order = InferSelectModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type OrderPayment = InferSelectModel<typeof orderPayments>;
export type OrderRefund = InferSelectModel<typeof orderRefunds>;
export type OrderRefundItem = InferSelectModel<typeof orderRefundItems>;
export type OrderEvent = InferSelectModel<typeof orderEvents>;
export type DraftOrder = InferSelectModel<typeof draftOrders>;
export type DraftOrderItem = InferSelectModel<typeof draftOrderItems>;
export type Market = InferSelectModel<typeof markets>;
export type Discount = InferSelectModel<typeof discounts>;
export type DiscountTarget = InferSelectModel<typeof discountTargets>;
export type DiscountCustomer = InferSelectModel<typeof discountCustomers>;
export type OrderDiscount = InferSelectModel<typeof orderDiscounts>;
export type OrderItemDiscount = InferSelectModel<typeof orderItemDiscounts>;
