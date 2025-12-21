import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

import * as schema from "./schema";

// Create a singleton pool for non-Vercel environments
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    pool = new Pool({
      connectionString,
      // Connection pool settings
      max: 20, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      // Keep connections alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // SSL configuration for secure connections
      ssl:
        connectionString.includes("sslmode=require") ||
        connectionString.includes("ssl=true")
          ? { rejectUnauthorized: false }
          : undefined,
    });

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle database client", err);
      // Don't exit the process, just log the error
    });

    // Handle connection errors
    pool.on("connect", (client) => {
      client.on("error", (err) => {
        console.error("Database client error:", err);
      });
    });

    // Graceful shutdown
    if (typeof process !== "undefined") {
      const gracefulShutdown = async () => {
        console.log("Closing database pool...");
        await pool?.end();
        process.exit(0);
      };

      process.on("SIGINT", gracefulShutdown);
      process.on("SIGTERM", gracefulShutdown);
    }
  }

  return pool;
}

export const db = process.env.VERCEL
  ? drizzleNeon({
      client: neon(process.env.DATABASE_URL!),
      schema,
      casing: "snake_case",
    })
  : drizzlePostgres(getPool(), {
      schema,
      casing: "snake_case",
    });
