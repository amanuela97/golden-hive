import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { markets, user, userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

// Load environment variables
config({ path: "./.env.local" });

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function backfillMarketCreatedBy() {
  try {
    console.log("Starting market createdBy backfill...");

    // Get the first admin user
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "Admin"))
      .limit(1);

    if (adminRole.length === 0) {
      console.log("No admin role found. Skipping backfill.");
      await pool.end();
      return;
    }

    const adminUsers = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.roleId, adminRole[0].id))
      .limit(1);

    if (adminUsers.length === 0) {
      console.log("No admin users found. Skipping backfill.");
      await pool.end();
      return;
    }

    const adminUserId = adminUsers[0].userId;

    // Update all markets without createdBy to use the first admin user
    const result = await db
      .update(markets)
      .set({ createdBy: adminUserId })
      .where(eq(markets.createdBy, null as any));

    console.log(`✅ Backfilled createdBy for markets with admin user: ${adminUserId}`);
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
  backfillMarketCreatedBy()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { backfillMarketCreatedBy };

