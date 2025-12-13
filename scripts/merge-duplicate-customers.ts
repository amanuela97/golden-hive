/**
 * Migration script to merge duplicate customers
 *
 * This script:
 * 1. Finds customers with duplicate emails (case-insensitive)
 * 2. For each group of duplicates:
 *    - Keeps the customer with userId (if any)
 *    - If multiple have userId, keeps the one with most recent order/creation
 *    - Updates all orders to reference the kept customer
 *    - Deletes duplicate customer records
 *
 * Run with: npx tsx scripts/merge-duplicate-customers.ts
 */

import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { customers, orders } from "../db/schema";
import { sql, eq, inArray } from "drizzle-orm";
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

interface CustomerWithOrderCount {
  id: string;
  email: string;
  userId: string | null;
  vendorId: string | null;
  createdAt: Date;
  orderCount: number;
  latestOrderDate: Date | null;
}

async function mergeDuplicateCustomers() {
  try {
    console.log("Starting duplicate customer merge migration...");

    // Get all customers and group by email (case-insensitive) in JavaScript
    const allCustomersList = await db
      .select({
        id: customers.id,
        email: customers.email,
        userId: customers.userId,
        vendorId: customers.vendorId,
        createdAt: customers.createdAt,
      })
      .from(customers);

    // Group by lowercase email
    const emailGroups = new Map<string, typeof allCustomersList>();
    for (const customer of allCustomersList) {
      const emailKey = customer.email.toLowerCase();
      if (!emailGroups.has(emailKey)) {
        emailGroups.set(emailKey, []);
      }
      emailGroups.get(emailKey)!.push(customer);
    }

    // Find duplicate groups
    const duplicateGroups: Array<{
      email: string;
      customers: typeof allCustomersList;
    }> = [];
    for (const [email, customerList] of emailGroups.entries()) {
      if (customerList.length > 1) {
        duplicateGroups.push({ email, customers: customerList });
      }
    }

    console.log(
      `Found ${duplicateGroups.length} email(s) with duplicate customers`
    );

    if (duplicateGroups.length === 0) {
      console.log("No duplicate customers found. Migration complete!");
      return;
    }

    let totalMerged = 0;
    let totalOrdersUpdated = 0;

    // Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\nProcessing duplicates for email: ${group.email}`);

      const allCustomers = group.customers;

      // Get order counts and latest order date for each customer
      const customersWithOrderInfo: CustomerWithOrderCount[] =
        await Promise.all(
          allCustomers.map(async (customer) => {
            const orderStats = await db
              .select({
                count: sql<number>`COUNT(*)`.as("count"),
                latestDate: sql<Date | null>`MAX(${orders.createdAt})`.as(
                  "latestDate"
                ),
              })
              .from(orders)
              .where(eq(orders.customerId, customer.id));

            return {
              ...customer,
              orderCount: Number(orderStats[0]?.count || 0),
              latestOrderDate: orderStats[0]?.latestDate || null,
            };
          })
        );

      // Determine which customer to keep
      // Priority: 1) Has userId, 2) Most recent order, 3) Most recent creation
      const customersWithUserId = customersWithOrderInfo.filter(
        (c) => c.userId !== null
      );

      let customerToKeep: CustomerWithOrderCount;

      if (customersWithUserId.length > 0) {
        // Keep the one with userId that has the most recent order or creation
        customerToKeep = customersWithUserId.sort((a, b) => {
          const aDate = a.latestOrderDate || a.createdAt;
          const bDate = b.latestOrderDate || b.createdAt;
          return bDate.getTime() - aDate.getTime();
        })[0];
        console.log(`  Keeping customer with userId: ${customerToKeep.id}`);
      } else {
        // No userId, keep the one with most recent order or creation
        customerToKeep = customersWithOrderInfo.sort((a, b) => {
          const aDate = a.latestOrderDate || a.createdAt;
          const bDate = b.latestOrderDate || b.createdAt;
          return bDate.getTime() - aDate.getTime();
        })[0];
        console.log(`  Keeping customer (no userId): ${customerToKeep.id}`);
      }

      // Get customers to merge (all except the one to keep)
      const customersToMerge = customersWithOrderInfo.filter(
        (c) => c.id !== customerToKeep.id
      );

      if (customersToMerge.length === 0) {
        console.log("  No customers to merge (only one found)");
        continue;
      }

      console.log(
        `  Merging ${customersToMerge.length} duplicate customer(s) into ${customerToKeep.id}`
      );

      // Update all orders to reference the kept customer
      const duplicateIds = customersToMerge.map((c) => c.id);
      const ordersToUpdate = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.customerId, duplicateIds));

      if (ordersToUpdate.length > 0) {
        await db
          .update(orders)
          .set({ customerId: customerToKeep.id })
          .where(inArray(orders.customerId, duplicateIds));

        console.log(
          `  Updated ${ordersToUpdate.length} order(s) to reference kept customer`
        );
        totalOrdersUpdated += ordersToUpdate.length;
      }

      // Update the kept customer if needed
      // If kept customer doesn't have userId but one of the duplicates does, update it
      const duplicateWithUserId = customersToMerge.find(
        (c) => c.userId !== null
      );
      if (!customerToKeep.userId && duplicateWithUserId?.userId) {
        await db
          .update(customers)
          .set({ userId: duplicateWithUserId.userId })
          .where(eq(customers.id, customerToKeep.id));
        console.log(`  Updated kept customer with userId from duplicate`);
      }

      // If kept customer doesn't have vendorId but one of the duplicates does, update it
      const duplicateWithVendorId = customersToMerge.find(
        (c) => c.vendorId !== null
      );
      if (!customerToKeep.vendorId && duplicateWithVendorId?.vendorId) {
        await db
          .update(customers)
          .set({ vendorId: duplicateWithVendorId.vendorId })
          .where(eq(customers.id, customerToKeep.id));
        console.log(`  Updated kept customer with vendorId from duplicate`);
      }

      // Delete duplicate customers
      await db.delete(customers).where(inArray(customers.id, duplicateIds));
      console.log(
        `  Deleted ${duplicateIds.length} duplicate customer record(s)`
      );

      totalMerged += duplicateIds.length;
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   - Merged ${totalMerged} duplicate customer record(s)`);
    console.log(
      `   - Updated ${totalOrdersUpdated} order(s) to reference kept customers`
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  mergeDuplicateCustomers()
    .then(() => {
      console.log("\nMigration script finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nMigration script failed:", error);
      process.exit(1);
    });
}

export { mergeDuplicateCustomers };
