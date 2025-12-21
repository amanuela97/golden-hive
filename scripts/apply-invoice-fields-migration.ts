/**
 * Script to apply invoice fields migration to orders table
 * Run with: npx tsx scripts/apply-invoice-fields-migration.ts
 */

import { config } from "dotenv";
import { Pool } from "pg";

// Load environment variables
config({ path: "./.env.local" });

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log("Applying invoice fields migration to orders table...");

    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('invoice_token', 'invoice_expires_at', 'invoice_sent_at', 'invoice_sent_count')
    `;
    const existingColumns = await client.query(checkQuery);
    const existingColumnNames = existingColumns.rows.map((row) => row.column_name);

    if (existingColumnNames.includes("invoice_token")) {
      console.log("✅ Migration already applied. Columns exist.");
      return;
    }

    // Apply migration
    await client.query("BEGIN");

    if (!existingColumnNames.includes("invoice_token")) {
      await client.query('ALTER TABLE "orders" ADD COLUMN "invoice_token" text');
      console.log("✅ Added invoice_token column");
    }

    if (!existingColumnNames.includes("invoice_expires_at")) {
      await client.query('ALTER TABLE "orders" ADD COLUMN "invoice_expires_at" timestamp');
      console.log("✅ Added invoice_expires_at column");
    }

    if (!existingColumnNames.includes("invoice_sent_at")) {
      await client.query('ALTER TABLE "orders" ADD COLUMN "invoice_sent_at" timestamp');
      console.log("✅ Added invoice_sent_at column");
    }

    if (!existingColumnNames.includes("invoice_sent_count")) {
      await client.query('ALTER TABLE "orders" ADD COLUMN "invoice_sent_count" integer DEFAULT 0');
      console.log("✅ Added invoice_sent_count column");
    }

    // Add unique constraint if it doesn't exist
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'orders' 
      AND constraint_name = 'orders_invoice_token_unique'
    `);

    if (constraintCheck.rows.length === 0) {
      await client.query('ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_token_unique" UNIQUE("invoice_token")');
      console.log("✅ Added unique constraint on invoice_token");
    }

    await client.query("COMMIT");
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  applyMigration()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

export { applyMigration };

