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

// 1️⃣ Categories table
export const category = pgTable("category", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // e.g. "Mad Honey", "Organic Honey"
  description: text("description"),
  requiresDocumentation: boolean("requires_documentation")
    .default(false)
    .notNull(),
  documentationDescription: text("documentation_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const listing = pgTable("listing", {
  id: uuid("id").primaryKey(), // unique listing ID
  producerId: text("producer_id") // link to users table (producer)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Basic product info
  name: text("name").notNull(), // e.g., "Himalayan Mad Honey"
  description: text("description"), // longer description
  category: uuid("category_id").references(() => category.id, {
    onDelete: "set null",
  }), // e.g., "Domestic Honey", "Mad Honey"
  imageUrl: text("image_url"), // main product image
  gallery: text("gallery").array(), // optional additional images
  tags: text("tags").array(),

  // Pricing & inventory
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // price per unit
  currency: text("currency").default("NPR").notNull(),
  stockQuantity: integer("stock_quantity").default(0), // available units
  unit: text("unit").default("kg"), // e.g., kg, g, bottle

  // Status & visibility
  isActive: boolean("is_active").default(false), // hide if false
  isFeatured: boolean("is_featured").default(false), // for homepage promotions
  marketType: marketTypeEnum("market_type").default("local"), // local or international

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Optional fields for advanced features
  ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }).default(
    "0"
  ),
  ratingCount: integer("rating_count").default(0),
  salesCount: integer("sales_count").default(0), // total sold units
  originVillage: text("origin_village"), // optional metadata
  harvestDate: timestamp("harvest_date"), // when honey was harvested
});

// 🧁 Hero Slider
export const homepageHero = pgTable(
  "homepage_hero",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageUrl: text("image_url").notNull(),
    title: text("title"),
    subtitle: text("subtitle"),
    ctaLabel: text("cta_label"),
    ctaLink: text("cta_link"),
    order: integer("order").default(0), // for ordering slides
    isActive: boolean("is_active").default(true),
  },
  (table) => [unique().on(table.order)]
);

// 🍯 About Section
export const homepageAbout = pgTable("homepage_about", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").default("Our Story"),
  content: text("content"),
  assetUrl: text("asset_url"),
  isActive: boolean("is_active").default(true),
});

// 🌻 Benefits Section
export const homepageBenefits = pgTable("homepage_benefits", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").default("Why Choose Golden Hive?"),
  items: jsonb("items")
    .$type<{ icon: string; title: string; description: string }[]>()
    .default([]),
  isActive: boolean("is_active").default(true),
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

export const categoryDocumentation = pgTable("category_documentation", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  documentationTypeId: uuid("documentation_type_id")
    .notNull()
    .references(() => documentationType.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

// ===================================
// NAVBAR
// ===================================
export const navbar = pgTable("navbar", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(), // e.g., "Golden Hive"
  logoUrl: varchar("logo_url", { length: 500 }).notNull(), // Cloudinary URL or static path
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const navbarItems = pgTable("navbar_items", {
  id: serial("id").primaryKey(),
  navbarId: integer("navbar_id")
    .notNull()
    .references(() => navbar.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull(),
  href: varchar("href", { length: 255 }).notNull(),
  order: integer("order").default(0),
  requiresAuth: boolean("requires_auth").default(false),
  isVisible: boolean("is_visible").default(true),
});

// ===================================
// FOOTER
// ===================================
export const footerSections = pgTable("footer_sections", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 150 }).notNull(), // e.g., "Office", "Payment", etc.
  order: integer("order").default(0),
});

export const footerItems = pgTable("footer_items", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => footerSections.id, { onDelete: "cascade" }),

  // For text, link, or icon-based entries
  text: varchar("text", { length: 255 }),
  href: varchar("href", { length: 255 }), // optional link
  icon: varchar("icon", { length: 100 }), // e.g., "MapPin", "Phone", "Mail"
  hasIcon: boolean("has_icon").default(false),

  // For lists (e.g., payment options)
  listItems: jsonb("list_items").$type<string[]>(),

  order: integer("order").default(0),
});

// ===================================
// ABOUT PAGE
// ===================================
export const aboutPage = pgTable("about_page", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<{
    openGraphTitle?: string;
    openGraphDescription?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Each section of the About page (hero, mission, values, etc.)
export const aboutSections = pgTable("about_sections", {
  id: serial("id").primaryKey(),
  aboutId: integer("about_id")
    .notNull()
    .references(() => aboutPage.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // e.g., 'hero', 'mission', 'values', 'cta'
  title: varchar("title", { length: 200 }),
  subtitle: varchar("subtitle", { length: 300 }),
  content: text("content"), // for paragraphs or rich text
  imageUrl: varchar("image_url", { length: 500 }), // Cloudinary image
  extraData: jsonb("extra_data").$type<{
    list?: { title: string; description?: string }[];
    features?: { title: string; description?: string }[];
    buttons?: { label: string; href: string; variant?: "solid" | "outline" }[];
  }>(),
  order: integer("order").default(0),
  isVisible: boolean("is_visible").default(true),
});

// Export feedbacks table
export { feedbacks } from "./schema/feedback";

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type Listing = InferSelectModel<typeof listing>;
export type DocumentationType = InferSelectModel<typeof documentationType>;
export type CategoryDocumentation = InferSelectModel<
  typeof categoryDocumentation
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
