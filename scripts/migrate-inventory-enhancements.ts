/**
 * Migration script to backfill inventory enhancements
 *
 * This script:
 * 1. Calculates initial on_hand values for all existing inventory_levels
 * 2. Backfills event_type in existing inventory_adjustments
 *
 * Run with: npx tsx scripts/migrate-inventory-enhancements.ts
 */

import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { inventoryLevels, inventoryAdjustments } from "../db/schema";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema";

// Load environment variables
config({ path: "./.env.local" });

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

async function migrateInventoryEnhancements() {
  try {
    console.log("Starting inventory enhancements migration...");

    // Calculate on_hand for all existing inventory_levels
    console.log("Calculating on_hand values...");
    const onHandResult = await db.execute(sql`
      UPDATE inventory_levels
      SET on_hand = available + committed
      WHERE on_hand IS NULL OR on_hand = 0
    `);

    console.log(`Updated on_hand for inventory levels`);

    // Backfill event_type in inventory_adjustments
    console.log("Backfilling event_type in inventory_adjustments...");
    const eventTypeResult = await db.execute(sql`
      UPDATE inventory_adjustments
      SET event_type = 'adjustment'
      WHERE event_type IS NULL
    `);

    console.log(`Backfilled event_type for inventory adjustments`);

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrateInventoryEnhancements()
    .then(() => {
      console.log("\nMigration script finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nMigration script failed:", error);
      process.exit(1);
    });
}

export { migrateInventoryEnhancements };


