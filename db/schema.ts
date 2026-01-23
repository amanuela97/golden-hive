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
  index,
  uniqueIndex,
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

// Seller balance transaction types
export const balanceTransactionTypeEnum = pgEnum("balance_transaction_type", [
  "order_payment",
  "platform_fee",
  "stripe_fee",
  "shipping_label",
  "refund",
  "dispute",
  "payout",
  "adjustment",
]);

// Payout status
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "canceled",
]);

// Transaction status for ledger entries
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "available",
  "paid",
]);

// Transfer status for order payments
export const transferStatusEnum = pgEnum("transfer_status", [
  "held",
  "transferred",
  "pending_payout",
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

export const storeVisibilityEnum = pgEnum("store_visibility", [
  "public",
  "hidden",
]);

// @ts-expect-error - Circular reference with markets table (resolved at runtime by Drizzle)
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
  // @ts-expect-error - Circular reference with markets table (resolved at runtime by Drizzle)
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

// ===================================
// CATEGORIES (Shopify Taxonomy)
// ===================================
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(), // Shopify taxonomy ID
    name: text("name").notNull(),
    handle: text("handle").notNull(), // URL-friendly slug
    parentId: text("parent_id"), // Self-reference - defined after table creation
    level: integer("level").notNull().default(0), // 0 = top-level
    fullName: text("full_name"), // Full path like "Home & Living > Furniture"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("categories_parent_idx").on(t.parentId),
    index("categories_level_idx").on(t.level),
    index("categories_handle_idx").on(t.handle),
  ]
);

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

export const listing = pgTable(
  "listing",
  {
    id: uuid("id").primaryKey(), // unique listing ID
    producerId: text("producer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Basic product info
    name: text("name").notNull(), // e.g. "Himalayan Mad Honey"
    description: text("description"),
    // Slug fields for SEO-friendly URLs
    slug: text("slug").notNull(),
    slugLower: text("slug_lower").notNull(),
    storeId: uuid("store_id")
      .references(() => store.id, {
        onDelete: "set null",
      })
      .notNull(), // Reference to store table
    categoryRuleId: uuid("category_rule_id").references(
      () => categoryRules.id,
      {
        onDelete: "set null",
      }
    ), // Optional - only required if category has documentation rules
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

    // Shipping profile
    shippingProfileId: uuid("shipping_profile_id").references(
      () => shippingProfiles.id,
      { onDelete: "set null" }
    ),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Optional metadata
    ratingAverage: numeric("rating_average", {
      precision: 3,
      scale: 2,
    }).default("0"),
    ratingCount: integer("rating_count").default(0),
    salesCount: integer("sales_count").default(0),
    originVillage: text("origin_village"),
    harvestDate: timestamp("harvest_date"),
  },
  (t) => [
    uniqueIndex("listing_slug_lower_unique").on(t.slugLower),
    index("listing_slug_idx").on(t.slug),
  ]
);

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
// @ts-expect-error - Circular reference with user table (resolved at runtime by Drizzle)
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
  // @ts-expect-error - Circular reference with user table (resolved at runtime by Drizzle)
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
export const store = pgTable(
  "store",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeName: text("store_name").notNull(),
    logoUrl: text("logo_url"),
    // Storefront fields
    slug: text("slug").notNull(),
    slugLower: text("slug_lower").notNull(),
    visibility: storeVisibilityEnum("visibility").notNull().default("public"),
    // Rating aggregates
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 })
      .notNull()
      .default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    followerCount: integer("follower_count").notNull().default(0),
    // Existing fields
    storeCurrency: text("store_currency").notNull().default("EUR"),
    unitSystem: text("unit_system").notNull().default("Metric system"), // "Metric system" | "Imperial system"
    stripeAccountId: text("stripe_account_id"), // Stripe Connect account ID
    stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(
      false
    ), // Track if onboarding is complete
    stripeChargesEnabled: boolean("stripe_charges_enabled").default(false), // Track if charges are enabled
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false), // Track if payouts are enabled
    // Admin moderation
    isApproved: boolean("is_approved").default(false).notNull(),
    approvedAt: timestamp("approved_at"),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("store_slug_lower_unique").on(t.slugLower),
    index("store_visibility_idx").on(t.visibility),
    index("store_rating_idx").on(t.ratingAvg),
    index("store_followers_idx").on(t.followerCount),
    index("store_approved_idx").on(t.isApproved),
  ]
);

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
// STORE SLUG HISTORY (SEO-safe redirects)
// ===================================
export const storeSlugHistory = pgTable(
  "store_slug_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    slugLower: text("slug_lower").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("store_slug_history_unique").on(t.slugLower),
    index("store_slug_history_store_idx").on(t.storeId),
  ]
);

// ===================================
// STORE BANNER IMAGES
// ===================================
export const storeBannerImage = pgTable(
  "store_banner_image",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("store_banner_store_idx").on(t.storeId),
    uniqueIndex("store_banner_store_order_unique").on(t.storeId, t.sortOrder),
  ]
);

// ===================================
// STORE ABOUT SECTION
// ===================================
export const storeAbout = pgTable("store_about", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => store.id, { onDelete: "cascade" }),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// STORE POLICIES
// ===================================
export const storePolicies = pgTable("store_policies", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => store.id, { onDelete: "cascade" }),
  shipping: text("shipping"),
  returns: text("returns"),
  cancellations: text("cancellations"),
  customOrders: text("custom_orders"),
  privacy: text("privacy"),
  additional: text("additional"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// STORE FOLLOW (follow/unfollow stores)
// ===================================
export const storeFollow = pgTable(
  "store_follow",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.storeId, t.userId] }),
    index("store_follow_user_idx").on(t.userId),
    index("store_follow_store_idx").on(t.storeId),
  ]
);

// ===================================
// PRODUCT REVIEWS
// ===================================
export const productReview = pgTable(
  "product_review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    // Support both authenticated and guest reviews
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null for guests
    guestName: text("guest_name"), // For guest reviews
    guestEmail: text("guest_email"), // For guest reviews
    rating: integer("rating").notNull(), // 1-5
    title: text("title"),
    comment: text("comment").notNull(), // Required comment
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }), // Required for verification
    verified: boolean("verified").default(true).notNull(), // All reviews are verified purchases
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("product_review_listing_idx").on(t.listingId),
    index("product_review_store_idx").on(t.storeId),
    index("product_review_user_idx").on(t.userId),
    index("product_review_order_idx").on(t.orderId),
    // Ensure one review per order per product
    unique("product_review_order_listing_unique").on(t.orderId, t.listingId),
  ]
);

// ===================================
// STORE REVIEWS
// ===================================
export const storeReview = pgTable(
  "store_review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    // Support both authenticated and guest reviews
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null for guests
    guestName: text("guest_name"), // For guest reviews
    guestEmail: text("guest_email"), // For guest reviews
    rating: integer("rating").notNull(), // 1-5
    title: text("title"),
    body: text("body").notNull(), // Required comment
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }), // Required for verification
    verified: boolean("verified").default(true).notNull(), // All reviews are verified purchases
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("store_review_store_idx").on(t.storeId),
    index("store_review_user_idx").on(t.userId),
    index("store_review_order_idx").on(t.orderId),
    // Ensure one review per order per store
    unique("store_review_order_store_unique").on(t.orderId, t.storeId),
  ]
);

// ===================================
// LISTING FAVORITES (product favorites)
// ===================================
export const listingFavorite = pgTable(
  "listing_favorite",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.userId] }),
    index("listing_favorite_user_idx").on(t.userId),
    index("listing_favorite_listing_idx").on(t.listingId),
  ]
);

// ===================================
// LISTING SLUG HISTORY (SEO-safe redirects)
// ===================================
export const listingSlugHistory = pgTable(
  "listing_slug_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    slugLower: text("slug_lower").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("listing_slug_history_unique").on(t.slugLower),
    index("listing_slug_history_listing_idx").on(t.listingId),
  ]
);

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
  weightGrams: integer("weight_grams").default(0), // Keep for backward compatibility
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

// ===================================
// INVENTORY LOCATIONS
// ===================================
export const inventoryLocations = pgTable("inventory_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Kathmandu Warehouse"
  address: text("address"), // Street address
  city: text("city"), // City
  state: text("state"), // State/Province (required for US, optional for others)
  zip: text("zip"), // ZIP/Postal code
  country: text("country"), // Country code (e.g., "US", "NP", "FI")
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
  // Human-friendly order number in format: GM-YYYY-XXXXXX
  orderNumber: text("order_number").notNull(), // Use this as "order_id" in UI

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
  // Shipping rate details
  shippingCarrier: text("shipping_carrier"), // Selected carrier (e.g., "USPS", "FedEx")
  shippingService: text("shipping_service"), // Service level (e.g., "Priority", "Express")
  shippingRateId: text("shipping_rate_id"), // EasyPost rate ID (for label purchase)

  // Cancellation fields
  cancellationRequestedAt: timestamp("cancellation_requested_at"),
  cancellationReason: text("cancellation_reason"),
  cancellationRequestedBy: text("cancellation_requested_by").references(
    () => user.id,
    { onDelete: "set null" }
  ),

  // Refund request fields
  refundRequestedAt: timestamp("refund_requested_at"),
  refundRequestReason: text("refund_request_reason"),
  refundRequestStatus: text("refund_request_status").default("none"), // "none" | "pending" | "approved" | "rejected"

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

  // Tracking token for public tracking page access
  trackingToken: text("tracking_token").unique(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// ORDER SHIPPING RATES (EasyPost)
// ===================================
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

// ===================================
// SHIPPING PROFILES
// ===================================
export const shippingProfiles = pgTable("shipping_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),

  name: text("name").notNull(), // e.g., "Standard Shipping", "International"

  pricingType: text("pricing_type").notNull(), // "manual" | "calculated"

  // Origin address
  originCountry: text("origin_country").notNull(), // "FI", "NP", "US"
  originPostalCode: text("origin_postal_code"), // ZIP/Postal code

  // Processing time
  processingDaysMin: integer("processing_days_min").notNull().default(1),
  processingDaysMax: integer("processing_days_max").notNull().default(3),

  // Default profile for new listings
  isDefault: boolean("is_default").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// SHIPPING DESTINATIONS
// ===================================
export const shippingDestinations = pgTable("shipping_destinations", {
  id: uuid("id").defaultRandom().primaryKey(),
  shippingProfileId: uuid("shipping_profile_id")
    .notNull()
    .references(() => shippingProfiles.id, { onDelete: "cascade" }),

  destinationType: text("destination_type").notNull(),
  // "country" | "region" | "everywhere_else"

  countryCode: text("country_code"), // "FI", "NP", null for "everywhere_else"
  regionCode: text("region_code"), // "EU", "ASIA" (future use)

  excluded: boolean("excluded").default(false), // For exclusions

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// SHIPPING RATES (Manual Pricing)
// ===================================
export const shippingRates = pgTable("shipping_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  destinationId: uuid("destination_id")
    .notNull()
    .references(() => shippingDestinations.id, { onDelete: "cascade" }),

  serviceName: text("service_name").notNull(), // "Standard", "Express", "Priority"

  freeShipping: boolean("free_shipping").default(false).notNull(),

  // Etsy-style pricing: first item + additional items
  firstItemPriceCents: integer("first_item_price_cents"), // null if freeShipping
  additionalItemPriceCents: integer("additional_item_price_cents").default(0),

  // Weight brackets (optional - for future use)
  minWeightOz: numeric("min_weight_oz", { precision: 8, scale: 1 }),
  maxWeightOz: numeric("max_weight_oz", { precision: 8, scale: 1 }),

  currency: text("currency").default("EUR").notNull(),

  // Transit time estimates
  transitDaysMin: integer("transit_days_min"),
  transitDaysMax: integer("transit_days_max"),

  // Display order
  sortOrder: integer("sort_order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// SHIPPING SERVICES (For Future Calculated Rates)
// ===================================
export const shippingServices = pgTable("shipping_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  shippingProfileId: uuid("shipping_profile_id")
    .notNull()
    .references(() => shippingProfiles.id, { onDelete: "cascade" }),

  carrier: text("carrier").notNull(), // "usps", "dhl", "posti", "easypost"
  serviceCode: text("service_code").notNull(), // API service code
  displayName: text("display_name").notNull(), // "Standard Shipping"

  enabled: boolean("enabled").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// ORDER SHIPMENTS (Shipping Snapshot)
// ===================================
export const orderShipments = pgTable("order_shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),

  // Snapshot of selected shipping option
  shippingProfileName: text("shipping_profile_name"), // Snapshot
  serviceName: text("service_name").notNull(), // "Standard", "Express"

  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull(),

  // For calculated rates (future)
  carrier: text("carrier"), // "USPS", "DHL", etc.
  trackingNumber: text("tracking_number"),
  rateId: text("rate_id"), // EasyPost rate ID if calculated

  // Estimated delivery
  estimatedDeliveryMin: timestamp("estimated_delivery_min"),
  estimatedDeliveryMax: timestamp("estimated_delivery_max"),

  // Shipping label cost tracking
  labelCostCents: integer("label_cost_cents"), // Actual cost when label was purchased
  labelCostDeducted: boolean("label_cost_deducted").default(false).notNull(), // Whether cost was deducted from balance
  deductedAt: timestamp("deducted_at"),

  // Label URL and file type (for EasyPost labels)
  labelUrl: text("label_url"), // EasyPost label URL
  labelFileType: text("label_file_type"), // "application/pdf", "image/png", "application/zpl"

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===================================
// DRAFT ORDERS
// ===================================
export const draftOrders = pgTable("draft_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftNumber: text("draft_number").notNull(), // Draft order number in format: GM-DRAFT-YYYY-XXXXXX

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
  // Shipping rate details
  shippingCarrier: text("shipping_carrier"), // Selected carrier (e.g., "USPS", "FedEx")
  shippingService: text("shipping_service"), // Service level (e.g., "Priority", "Express")
  shippingRateId: text("shipping_rate_id"), // EasyPost rate ID (for label purchase)

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
  transferStatus: transferStatusEnum("transfer_status")
    .default("held")
    .notNull(), // held | transferred | pending_payout
  stripeTransferId: text("stripe_transfer_id"), // Stripe Transfer ID (only set when transferred)
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
  // Fee tracking fields
  feePaidBy: text("fee_paid_by"), // "platform" | "seller" | "customer"
  stripeFeeAmount: numeric("stripe_fee_amount", {
    precision: 10,
    scale: 2,
  }), // Stripe fee that was not refunded
  refundMethod: text("refund_method"), // "void" | "refund" | "manual"
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
// REFUND REQUESTS
// ===================================
export const refundRequests = pgTable("refund_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  reason: text("reason").notNull(),
  description: text("description"),
  evidenceImages: text("evidence_images").array(), // URLs to uploaded images
  status: text("status").default("pending").notNull(), // "pending" | "approved" | "rejected"
  reviewedBy: text("reviewed_by").references(() => user.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
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
  // Vendor-level fulfillment status
  vendorFulfillmentStatus: orderFulfillmentStatusEnum(
    "vendor_fulfillment_status"
  )
    .default("unfulfilled")
    .notNull(),
  status: text("status").default("pending"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  // Fulfillment metadata (per inst.md)
  carrier: text("carrier"), // UPS, Posti, DHL, etc.
  carrierCode: text("carrier_code"), // EasyPost code: ups, fedex, usps
  trackingStatus: text("tracking_status"), // Latest status from EasyPost
  trackingData: jsonb("tracking_data"), // Full tracking response from EasyPost
  lastTrackedAt: timestamp("last_tracked_at"), // When tracking was last updated
  easypostShipmentId: text("easypost_shipment_id"), // EasyPost shipment ID
  labelUrl: text("label_url"), // URL to shipping label PDF
  labelFileType: text("label_file_type"), // "application/pdf", "image/png", "application/zpl"
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
export type StoreFollow = InferSelectModel<typeof storeFollow>;
export type ListingFavorite = InferSelectModel<typeof listingFavorite>;
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
export type RefundRequest = InferSelectModel<typeof refundRequests>;
export type OrderEvent = InferSelectModel<typeof orderEvents>;
export type OrderShippingRates = InferSelectModel<typeof orderShippingRates>;
export type ShippingProfile = InferSelectModel<typeof shippingProfiles>;
export type ShippingDestination = InferSelectModel<typeof shippingDestinations>;
export type ShippingRate = InferSelectModel<typeof shippingRates>;
export type ShippingService = InferSelectModel<typeof shippingServices>;
export type OrderShipment = InferSelectModel<typeof orderShipments>;
export type DraftOrder = InferSelectModel<typeof draftOrders>;
export type DraftOrderItem = InferSelectModel<typeof draftOrderItems>;
export type Market = InferSelectModel<typeof markets>;
export type Discount = InferSelectModel<typeof discounts>;
export type DiscountTarget = InferSelectModel<typeof discountTargets>;
export type DiscountCustomer = InferSelectModel<typeof discountCustomers>;
export type OrderDiscount = InferSelectModel<typeof orderDiscounts>;
export type OrderItemDiscount = InferSelectModel<typeof orderItemDiscounts>;
export type ProductReview = InferSelectModel<typeof productReview>;
export type StoreReview = InferSelectModel<typeof storeReview>;

// ===================================
// SELLER BALANCES (Ledger System)
// ===================================
export const sellerBalances = pgTable("seller_balances", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" })
    .unique(), // One balance per store

  // Current balance (can be negative)
  availableBalance: numeric("available_balance", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(), // Funds available for payout

  pendingBalance: numeric("pending_balance", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(), // Funds pending (e.g., in dispute period)

  currency: text("currency").default("EUR").notNull(),

  // Metadata
  lastPayoutAt: timestamp("last_payout_at"),
  lastPayoutAmount: numeric("last_payout_amount", {
    precision: 10,
    scale: 2,
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// SELLER BALANCE TRANSACTIONS (Immutable Ledger)
// ===================================
export const sellerBalanceTransactions = pgTable(
  "seller_balance_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),

    // Transaction details
    type: balanceTransactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // Always positive, use type to determine +/-
    currency: text("currency").notNull(),

    // References
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    orderPaymentId: uuid("order_payment_id").references(
      () => orderPayments.id,
      {
        onDelete: "set null",
      }
    ),
    orderShipmentId: uuid("order_shipment_id").references(
      () => orderShipments.id,
      { onDelete: "set null" }
    ),
    payoutId: uuid("payout_id").references(() => sellerPayouts.id, {
      onDelete: "set null",
    }),

    // Balance snapshots (for audit trail)
    balanceBefore: numeric("balance_before", {
      precision: 10,
      scale: 2,
    }).notNull(),
    balanceAfter: numeric("balance_after", {
      precision: 10,
      scale: 2,
    }).notNull(),

    // Status and availability tracking
    status: transactionStatusEnum("status").default("pending").notNull(),
    availableAt: timestamp("available_at"), // When funds become available (for hold periods)

    description: text("description"), // Human-readable description
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("seller_balance_transactions_store_idx").on(t.storeId),
    index("seller_balance_transactions_order_idx").on(t.orderId),
    index("seller_balance_transactions_type_idx").on(t.type),
  ]
);

// ===================================
// SELLER PAYOUTS (Payout Requests)
// ===================================
export const sellerPayouts = pgTable("seller_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),

  // Payout details
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),

  status: payoutStatusEnum("status").default("pending").notNull(),

  // Stripe transfer details
  stripeTransferId: text("stripe_transfer_id"), // Stripe Transfer ID
  stripePayoutId: text("stripe_payout_id"), // Stripe Payout ID (if using payouts)

  // Request details
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  requestedBy: text("requested_by").references(() => user.id, {
    onDelete: "set null",
  }),

  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),

  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// SELLER PAYOUT SETTINGS
// ===================================
export const sellerPayoutSettings = pgTable("seller_payout_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" })
    .unique(), // One settings record per store

  method: text("method").default("manual").notNull(), // "manual" | "automatic"
  schedule: text("schedule"), // "weekly" | "biweekly" | "monthly" | null
  minimumAmount: numeric("minimum_amount", { precision: 10, scale: 2 })
    .default("20.00")
    .notNull(),
  payoutDayOfWeek: integer("payout_day_of_week"), // 0-6 (Sunday-Saturday)
  payoutDayOfMonth: integer("payout_day_of_month"), // 1-31
  holdPeriodDays: integer("hold_period_days").default(7).notNull(), // Hold period in days
  nextPayoutAt: timestamp("next_payout_at"), // Next scheduled payout date

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// SHIPPING PACKAGES (Custom Packages)
// ===================================
export const shippingPackages = pgTable("shipping_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => store.id, { onDelete: "cascade" }),

  name: text("name").notNull(), // e.g., "Small Box", "Medium Envelope"
  description: text("description"), // Optional description

  // Dimensions in inches (stored in DB)
  lengthIn: numeric("length_in", { precision: 8, scale: 2 }).notNull(),
  widthIn: numeric("width_in", { precision: 8, scale: 2 }).notNull(),
  heightIn: numeric("height_in", { precision: 8, scale: 2 }).notNull(),

  // Weight in ounces (stored in DB)
  weightOz: numeric("weight_oz", { precision: 8, scale: 2 }).notNull(),

  // Metadata
  isDefault: boolean("is_default").default(false).notNull(), // One default per store
  sortOrder: integer("sort_order").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ===================================
// CHAT SYSTEM
// ===================================
// Chat Room Status Enum
export const chatRoomStatusEnum = pgEnum("chat_room_status", [
  "active",
  "blocked",
  "archived",
]);

// Chat Rooms - One room per order + store combination
export const chatRooms = pgTable(
  "chat_rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "set null" }), // Nullable - stores first orderId, but room persists across orders
    storeId: uuid("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Seller is derived from storeId via storeMembers, but we store for quick access
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    status: chatRoomStatusEnum("status").default("active").notNull(),
    // Per-user blocking: each user can block independently
    buyerBlocked: boolean("buyer_blocked").default(false).notNull(),
    sellerBlocked: boolean("seller_blocked").default(false).notNull(),
    // Per-user deletion: each user can delete the chat from their view
    buyerDeleted: boolean("buyer_deleted").default(false).notNull(),
    sellerDeleted: boolean("seller_deleted").default(false).notNull(),
    // Legacy fields (kept for backwards compatibility, but not used)
    blockedBy: text("blocked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    blockedAt: timestamp("blocked_at"),

    // Metadata
    lastMessageAt: timestamp("last_message_at"),
    lastMessagePreview: text("last_message_preview"), // First 100 chars of last message

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Ensure one room per buyer+store combination (not per order)
    unique("chat_rooms_buyer_store_unique").on(t.buyerId, t.storeId),
    index("chat_rooms_order_idx").on(t.orderId),
    index("chat_rooms_store_idx").on(t.storeId),
    index("chat_rooms_buyer_idx").on(t.buyerId),
    index("chat_rooms_seller_idx").on(t.sellerId),
    index("chat_rooms_status_idx").on(t.status),
  ]
);

// Chat Messages
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),

    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    senderRole: text("sender_role").notNull(), // "customer" | "seller" | "admin"

    // Message content
    text: text("text"), // Nullable if media-only message
    mediaUrl: text("media_url"), // Cloudinary URL
    mediaType: text("media_type"), // "image" | "video" | "file"
    mediaFileName: text("media_file_name"), // Original filename
    mediaPublicId: text("media_public_id"), // Cloudinary public_id for deletion

    // Message status
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),

    // Read receipts (optional - for future enhancement)
    readAt: timestamp("read_at"),
    readBy: text("read_by").array(), // Array of user IDs who read the message

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("chat_messages_room_idx").on(t.roomId),
    index("chat_messages_sender_idx").on(t.senderId),
    index("chat_messages_created_idx").on(t.createdAt),
  ]
);

// Chat Room Participants (for admin tracking and future features)
export const chatRoomParticipants = pgTable(
  "chat_room_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => chatRooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "buyer" | "seller" | "admin"

    // Admin-specific fields
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
    isVisible: boolean("is_visible").default(true).notNull(), // For admin invisibility

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Ensure one participant record per user per room
    unique("chat_room_participants_unique").on(t.roomId, t.userId),
    index("chat_room_participants_room_idx").on(t.roomId),
    index("chat_room_participants_user_idx").on(t.userId),
  ]
);

// Type exports
export type SellerBalance = InferSelectModel<typeof sellerBalances>;
export type SellerBalanceTransaction = InferSelectModel<
  typeof sellerBalanceTransactions
>;
export type SellerPayout = InferSelectModel<typeof sellerPayouts>;
export type SellerPayoutSettings = InferSelectModel<
  typeof sellerPayoutSettings
>;
export type ShippingPackage = InferSelectModel<typeof shippingPackages>;
export type ChatRoom = InferSelectModel<typeof chatRooms>;
export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type ChatRoomParticipant = InferSelectModel<typeof chatRoomParticipants>;
