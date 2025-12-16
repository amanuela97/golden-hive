/**
 * Migration script to backfill marketId for existing users
 * 
 * This script:
 * 1. Ensures a default market exists (EUR, isDefault = true)
 * 2. Updates all seller/admin users with null marketId to use the default market
 * 
 * Run with: npx tsx scripts/backfill-user-markets.ts
 */

import { db } from "../db";
import { user, userRoles, roles, markets } from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { config } from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

async function backfillUserMarkets() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log("Starting market backfill migration...");

    // Step 1: Ensure default market exists
    console.log("Checking for default market...");
    const defaultMarket = await db
      .select()
      .from(markets)
      .where(and(eq(markets.isDefault, true), eq(markets.status, "active")))
      .limit(1);

    let defaultMarketId: string;

    if (defaultMarket.length === 0) {
      console.log("Default market not found. Creating Europe (EUR) market...");
      const newMarket = await db
        .insert(markets)
        .values({
          name: "Europe",
          currency: "EUR",
          countries: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
          exchangeRate: "1.000000", // Base currency
          roundingRule: "none",
          status: "active",
          isDefault: true,
        })
        .returning();

      defaultMarketId = newMarket[0].id;
      console.log(`Created default market: ${newMarket[0].name} (${newMarket[0].currency})`);
    } else {
      defaultMarketId = defaultMarket[0].id;
      console.log(`Using existing default market: ${defaultMarket[0].name} (${defaultMarket[0].currency})`);
    }

    // Step 2: Get all seller/admin users with null marketId
    console.log("Finding users without market assignment...");
    const usersWithoutMarket = await db
      .select({
        userId: user.id,
        roleName: roles.name,
      })
      .from(user)
      .innerJoin(userRoles, eq(user.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          isNull(user.marketId),
          sql`LOWER(${roles.name}) IN ('seller', 'admin')`
        )
      );

    console.log(`Found ${usersWithoutMarket.length} users without market assignment`);

    if (usersWithoutMarket.length === 0) {
      console.log("No users need market assignment. Migration complete.");
      return;
    }

    // Step 3: Update users with default market
    console.log("Assigning default market to users...");
    const userIds = usersWithoutMarket.map((u) => u.userId);
    
    let updatedCount = 0;
    for (const userId of userIds) {
      await db
        .update(user)
        .set({ marketId: defaultMarketId })
        .where(eq(user.id, userId));
      updatedCount++;
    }

    console.log(`✅ Successfully assigned market to ${updatedCount} users`);
    console.log("Migration complete!");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
backfillUserMarkets()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });

