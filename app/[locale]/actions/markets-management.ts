"use server";

import { db } from "@/db";
import { markets, user, userRoles, roles } from "@/db/schema";
import { eq, and, sql, desc, asc, like, or, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ActionResponse } from "@/lib/types";

/**
 * Helper function to check if user is admin
 */
async function checkIsAdmin(userId: string): Promise<boolean> {
  const adminRole = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "Admin"))
    .limit(1);

  if (adminRole.length === 0) {
    return false;
  }

  const userRole = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, adminRole[0].id)
      )
    )
    .limit(1);

  return userRole.length > 0;
}

/**
 * List markets owned by the current user (admin or seller)
 * Users can only see and manage their own markets
 */
export async function listMarkets(search?: string): Promise<
  ActionResponse & {
    data?: Array<{
      id: string;
      name: string;
      currency: string;
      status: "active" | "draft";
      countries: string[] | null;
      exchangeRate: string;
      isDefault: boolean;
    }>;
  }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is admin or seller
    const userRole = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const roleName = userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "";
    if (roleName !== "seller" && roleName !== "admin") {
      return { success: false, error: "Unauthorized - Admin or Seller only" };
    }

    // Build query with ownership filter
    let query = db
      .select({
        id: markets.id,
        name: markets.name,
        currency: markets.currency,
        status: markets.status,
        countries: markets.countries,
        exchangeRate: markets.exchangeRate,
        isDefault: markets.isDefault,
      })
      .from(markets)
      .where(eq(markets.createdBy, session.user.id));

    if (search && search.trim()) {
      query = query.where(
        and(
          eq(markets.createdBy, session.user.id),
          or(
            like(markets.name, `%${search.trim()}%`),
            like(markets.currency, `%${search.trim()}%`)
          )
        )
      ) as typeof query;
    }

    const result = await query.orderBy(desc(markets.isDefault), asc(markets.name));

    // Parse countries safely
    const parsedResult = result.map((market) => {
      let countriesArray: string[] | null = null;
      try {
        if (market.countries) {
          if (Array.isArray(market.countries)) {
            countriesArray = market.countries;
          } else if (typeof market.countries === "string") {
            countriesArray = JSON.parse(market.countries);
          }
        }
      } catch (error) {
        console.error("Error parsing countries:", error);
      }

      return {
        id: market.id,
        name: market.name,
        currency: market.currency,
        status: market.status as "active" | "draft",
        countries: countriesArray,
        exchangeRate: String(market.exchangeRate || "1"),
        isDefault: market.isDefault || false,
      };
    });

    return {
      success: true,
      data: parsedResult,
    };
  } catch (error) {
    console.error("Error listing markets:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list markets",
    };
  }
}

/**
 * Get a single market by ID
 */
export async function getMarketById(marketId: string): Promise<
  ActionResponse & {
    data?: {
      id: string;
      name: string;
      currency: string;
      status: "active" | "draft";
      countries: string[] | null;
      exchangeRate: string;
      roundingRule: string | null;
      isDefault: boolean;
    };
  }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is admin or seller
    const userRole = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const roleName = userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "";
    if (roleName !== "seller" && roleName !== "admin") {
      return { success: false, error: "Unauthorized - Admin or Seller only" };
    }

    // Only get market if it belongs to the current user
    const result = await db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.id, marketId),
          eq(markets.createdBy, session.user.id)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "Market not found or you don't have permission to view it" };
    }

    const market = result[0];
    let countriesArray: string[] | null = null;
    try {
      if (market.countries) {
        if (Array.isArray(market.countries)) {
          countriesArray = market.countries;
        } else if (typeof market.countries === "string") {
          countriesArray = JSON.parse(market.countries);
        }
      }
    } catch (error) {
      console.error("Error parsing countries:", error);
    }

    return {
      success: true,
      data: {
        id: market.id,
        name: market.name,
        currency: market.currency,
        status: market.status as "active" | "draft",
        countries: countriesArray,
        exchangeRate: String(market.exchangeRate || "1"),
        roundingRule: market.roundingRule,
        isDefault: market.isDefault || false,
      },
    };
  } catch (error) {
    console.error("Error getting market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get market",
    };
  }
}

/**
 * Get exchange rate from API
 */
export async function getExchangeRate(
  currency: string,
  baseCurrency: string = "EUR"
): Promise<{ success: boolean; rate?: number; error?: string }> {
  try {
    // Using exchangerate-api.com (free, no API key needed)
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates");
    }

    const data = await response.json();
    const rate = data.rates[currency];

    if (!rate) {
      return { success: false, error: `Exchange rate not found for ${currency}` };
    }

    return { success: true, rate };
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch exchange rate",
    };
  }
}

/**
 * Create a new market
 */
export async function createMarket(input: {
  name: string;
  currency: string;
  countries: string[];
  roundingRule?: string;
  status?: "active" | "draft";
  isDefault?: boolean;
}): Promise<ActionResponse & { marketId?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is admin or seller
    const userRole = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const roleName = userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "";
    if (roleName !== "seller" && roleName !== "admin") {
      return { success: false, error: "Unauthorized - Admin or Seller only" };
    }

    // Get exchange rate from API
    const exchangeRateResult = await getExchangeRate(input.currency, "EUR");
    if (!exchangeRateResult.success || !exchangeRateResult.rate) {
      return {
        success: false,
        error: exchangeRateResult.error || "Failed to get exchange rate",
      };
    }

    // If setting as default, unset other defaults (only for user's own markets)
    if (input.isDefault) {
      await db
        .update(markets)
        .set({ isDefault: false })
        .where(
          and(
            eq(markets.isDefault, true),
            eq(markets.createdBy, session.user.id)
          )
        );
    }

    const result = await db
      .insert(markets)
      .values({
        name: input.name.trim(),
        currency: input.currency,
        countries: input.countries,
        exchangeRate: String(exchangeRateResult.rate),
        roundingRule: input.roundingRule || "none",
        status: input.status || "active",
        isDefault: input.isDefault || false,
        createdBy: session.user.id,
      })
      .returning();

    return {
      success: true,
      marketId: result[0]?.id || "",
    };
  } catch (error) {
    console.error("Error creating market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create market",
    };
  }
}

/**
 * Update a market
 */
export async function updateMarket(
  marketId: string,
  input: {
    name?: string;
    currency?: string;
    countries?: string[];
    roundingRule?: string;
    status?: "active" | "draft";
    isDefault?: boolean;
  }
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is admin or seller
    const userRole = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const roleName = userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "";
    if (roleName !== "seller" && roleName !== "admin") {
      return { success: false, error: "Unauthorized - Admin or Seller only" };
    }

    // Get current market (only if owned by current user)
    const currentMarket = await db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.id, marketId),
          eq(markets.createdBy, session.user.id)
        )
      )
      .limit(1);

    if (currentMarket.length === 0) {
      return { success: false, error: "Market not found or you don't have permission to edit it" };
    }

    // If changing status to draft, check if there's at least one other active market
    if (input.status === "draft") {
      const activeMarkets = await db
        .select({ id: markets.id })
        .from(markets)
        .where(
          and(
            eq(markets.status, "active"),
            ne(markets.id, marketId)
          )
        )
        .limit(1);

      if (activeMarkets.length === 0) {
        return {
          success: false,
          error: "Cannot set market to draft. At least one active market is required.",
        };
      }
    }

    // Get exchange rate if currency changed
    let exchangeRate = currentMarket[0].exchangeRate;
    if (input.currency && input.currency !== currentMarket[0].currency) {
      const exchangeRateResult = await getExchangeRate(input.currency, "EUR");
      if (exchangeRateResult.success && exchangeRateResult.rate) {
        exchangeRate = String(exchangeRateResult.rate);
      }
    }

    // If setting as default, unset other defaults (only for user's own markets)
    if (input.isDefault) {
      await db
        .update(markets)
        .set({ isDefault: false })
        .where(
          and(
            eq(markets.isDefault, true),
            eq(markets.createdBy, session.user.id),
            ne(markets.id, marketId)
          )
        );
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.countries !== undefined) updateData.countries = input.countries;
    if (input.roundingRule !== undefined)
      updateData.roundingRule = input.roundingRule;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (exchangeRate !== currentMarket[0].exchangeRate)
      updateData.exchangeRate = exchangeRate;

    await db.update(markets).set(updateData).where(eq(markets.id, marketId));

    return { success: true };
  } catch (error) {
    console.error("Error updating market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update market",
    };
  }
}

/**
 * Delete a market (with validation)
 */
export async function deleteMarket(marketId: string): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify user is admin or seller
    const userRole = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const roleName = userRole.length > 0 ? userRole[0].roleName.toLowerCase() : "";
    if (roleName !== "seller" && roleName !== "admin") {
      return { success: false, error: "Unauthorized - Admin or Seller only" };
    }

    // Get market to check if it's active and owned by user
    const market = await db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.id, marketId),
          eq(markets.createdBy, session.user.id)
        )
      )
      .limit(1);

    if (market.length === 0) {
      return { success: false, error: "Market not found or you don't have permission to delete it" };
    }

    // Check if this is the user's only market
    const userMarkets = await db
      .select({ id: markets.id })
      .from(markets)
      .where(eq(markets.createdBy, session.user.id))
      .limit(2);

    if (userMarkets.length <= 1) {
      return {
        success: false,
        error: "Cannot delete market. You must have at least one market.",
      };
    }

    // If deleting an active market, ensure at least one other active market exists for this user
    if (market[0].status === "active") {
      const activeUserMarkets = await db
        .select({ id: markets.id })
        .from(markets)
        .where(
          and(
            eq(markets.createdBy, session.user.id),
            eq(markets.status, "active"),
            ne(markets.id, marketId)
          )
        )
        .limit(1);

      if (activeUserMarkets.length === 0) {
        return {
          success: false,
          error: "Cannot delete market. You must have at least one active market.",
        };
      }
    }

    await db.delete(markets).where(eq(markets.id, marketId));

    return { success: true };
  } catch (error) {
    console.error("Error deleting market:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete market",
    };
  }
}

