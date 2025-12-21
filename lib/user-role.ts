import { cache } from "react";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Cached function to get user role
 * Uses React cache() to deduplicate requests within the same render
 */
export const getUserRole = cache(
  async (
    userId: string
  ): Promise<{
    roleName: string | null;
    error?: string;
  }> => {
    try {
      const userRole = await db
        .select({
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId))
        .limit(1);

      if (userRole.length === 0) {
        return { roleName: null, error: "No role found" };
      }

      return { roleName: userRole[0].roleName.toLowerCase() };
    } catch (error) {
      console.error("Error fetching user role:", error);
      return {
        roleName: null,
        error: error instanceof Error ? error.message : "Failed to fetch role",
      };
    }
  }
);
