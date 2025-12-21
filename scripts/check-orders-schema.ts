/**
 * Script to check orders table schema
 * Run with: npx tsx scripts/check-orders-schema.ts
 */

import { config } from "dotenv";
import { Pool } from "pg";

// Load environment variables
config({ path: "./.env.local" });

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log("Checking orders table schema...\n");

    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name LIKE 'invoice%'
      ORDER BY column_name
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log("❌ No invoice columns found in orders table!");
    } else {
      console.log("Found invoice columns:");
      result.rows.forEach((row) => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }

    // Also check all columns to see what's there
    const allColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `;
    const allColumns = await client.query(allColumnsQuery);
    console.log(`\nTotal columns in orders table: ${allColumns.rows.length}`);
    
  } catch (error) {
    console.error("❌ Error checking schema:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

