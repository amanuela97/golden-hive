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

// Shopify-style status enum: active | draft | archived
export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "draft",
  "archived",
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
  vendorId: uuid("vendor_id")
    .references(() => vendor.id, {
      onDelete: "set null",
    })
    .notNull(), // Reference to vendor table
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
// VENDOR
// ===================================
export const vendor = pgTable("vendor", {
  id: uuid("id").defaultRandom().primaryKey(),
  storeName: text("store_name").notNull(),
  logoUrl: text("logo_url"),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
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
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendor.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Kathmandu Warehouse"
  address: text("address"),
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
  orderId: uuid("order_id"),
  vendorId: uuid("vendor_id").references(() => vendor.id, {
    onDelete: "set null",
  }),
  locationId: uuid("location_id").references(() => inventoryLocations.id, {
    onDelete: "set null",
  }),
  status: text("status").default("pending"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
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
export type Vendor = InferSelectModel<typeof vendor>;
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
