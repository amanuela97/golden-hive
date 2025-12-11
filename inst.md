ChatGPT said:

Below is a fully re-designed product creation workflow that matches Shopify’s architecture and fits your new relational tables (listings, variants, inventoryItems, inventoryLevels).

This tells you:

What fields the user should fill in the product form

Which tables are created when a new product is submitted

How to automatically create inventory items + inventory levels like Shopify

Your updated minimal product form structure

✅ 1. What Data Should You Ask the User in the Product Creation Form?

Now that variants and inventory are NOT part of listing, your product form should ONLY contain product-level fields.

✔ Product-Level Fields (ask the user)

These belong in your listing table:

Field Meaning
name Product title
description Product description
taxonomyCategoryId Category
images / gallery Product images
tags Search tags
status draft / active
marketType depends on your app
originVillage custom attribute
harvestDate custom attribute
✔ Price & Compare-at Price

You can still allow a “default price” for the product.
But variants overwrite this, like Shopify:

If no variants: the product uses default price

If variants exist: variant price is required

✔ Variants Section (if variants are used)

This should now be part of the form UI, BUT not stored in listing — you will create rows in listing_variants.

Variant fields you should collect:

variant title (e.g., "500g" / "1kg")

SKU

variant price

variant compareAtPrice

variant image

options (size, weight, color, etc.)

✔ Inventory fields that user SHOULD report

But NOT stored on the listing:

Field Used For Saved Where?
initial stock quantity Starting inventory → inventory_levels.available
cost per item (optional) COGS → inventory_items.costPerItem
fulfillment location Which warehouse the stock goes to → inventory_levels.locationId

This mirrors Shopify:
When creating a new product, Shopify asks:

Track inventory?

Quantity

Location

Cost per item

…but stores each piece in a different table.

🟦 2. When Creating a New Product, Which Tables Do You Insert Into?
NEW PRODUCT CREATION WORKFLOW (Shopify-style)

For each product creation:

➤ Step 1: Insert into listing

Product-level information only.

const listing = await db.insert(listing).values({
name,
description,
vendorId,
taxonomyCategoryId,
price: defaultPrice,
status,
tags
});

➤ Step 2 (if no variants): Create a default variant

Shopify always creates at least one variant.

A product can have at max 3 options and 100 variants in total. make sure to set this restriction

ProductVariant always exists, even for products without variants.

const variant = await db.insert(listingVariants).values({
listingId: listing.id,
title: "Default",
price: defaultPrice,
});

➤ Step 3: For each variant → Create InventoryItem

(Like Shopify’s inventory_item_id)

const inventoryItem = await db.insert(inventoryItems).values({
variantId: variant.id,
costPerItem,
requiresShipping: true
});

➤ Step 4: For each variant → For each vendor location → Create InventoryLevels

(Where stock is actually stored)

await db.insert(inventoryLevels).values({
inventoryItemId: inventoryItem.id,
locationId,
available: initialStock,
committed: 0,
incoming: 0
});

⭐ This EXACTLY matches Shopify behavior:

When you create:

One product

With 3 variants

With 2 warehouse locations

Shopify creates:

Table Count Why
ProductVariant 3 rows One per variant
InventoryItem 3 rows 1:1 with variant
InventoryLevel 6 rows (3 variants × 2 locations)

And this is what you must replicate.

🟩 3. Updated New Product Form (clean + scalable)

Your new form does NOT need:

❌ stockQuantity
❌ variants as JSON

NEW PRODUCT FORM VALUES (Correct Version)
{
name: "",
description: "",
taxonomyCategoryId: "",
tags: [],
price: 0, // default price
compareAtPrice: null,
currency: "NPR",
status: "draft",
isFeatured: false,
marketType: "local",
originVillage: "",
harvestDate: "",

// New:
variants: [
{
title: "",
sku: "",
price: 0,
compareAtPrice: null,
imageUrl: "",
options: { size: "500g" }
}
],

// Inventory:
tracksInventory: true,
initialStock: 100, // Simple start stock
costPerItem: 0, // Optional
inventoryLocationId: "" // Required for multi-location
}

🟧 4. Visual Flow (Very Important)
User fills product form

↓
You create a listing
↓
For each variant: create a listing_variant
↓
For each variant: create an inventory_item
↓
For each variant and location: create an inventory_level

Just like Shopify.

🟩 5. Example Flow
User creates product:

Title: "Himalayan Honey"

Variants:

500g: price 1200 → initial stock: 30

1kg: price 2200 → initial stock: 10

Vendor has 1 location: "Kathmandu Warehouse"

Cost per item: 900

You create:
Table Rows
listing 1
listing_variants 2
inventory_items 2
inventory_levels 2
🎉 Final Answer Summary

1. What should you ask in the product form?

Product info

Optional default price

Variants (structured, not JSON)

Initial stock per variant

Location where stock is stored

Cost per item

2. Which tables do you create on product creation?

listing

listing_variants

inventory_items

inventory_levels
