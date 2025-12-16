"use server";

import { db } from "@/db";
import { markets, user } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Get the default market (EUR, isDefault = true)
 */
export async function getDefaultMarket(): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    currency: string;
    exchangeRate: string;
    roundingRule: string | null;
    countries: string[] | null;
  };
  error?: string;
}> {
  try {
    const result = await db
      .select({
        id: markets.id,
        name: markets.name,
        currency: markets.currency,
        exchangeRate: markets.exchangeRate,
        roundingRule: markets.roundingRule,
        countries: markets.countries,
      })
      .from(markets)
      .where(and(eq(markets.isDefault, true), eq(markets.status, "active")))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Default market not found",
      };
    }

    // Handle jsonb to array conversion safely
    let countriesArray: string[] | null = null;
    try {
      const countriesValue = result[0].countries;
      if (countriesValue) {
        if (Array.isArray(countriesValue)) {
          countriesArray = countriesValue;
        } else if (typeof countriesValue === "string") {
          // Only parse if it's a string and looks like JSON
          const trimmed = String(countriesValue).trim();
          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            countriesArray = JSON.parse(trimmed);
          } else {
            // Not JSON, treat as single value
            countriesArray = [trimmed];
          }
        } else if (typeof countriesValue === "object") {
          // Already an object, try to convert to array
          countriesArray = Array.isArray(countriesValue)
            ? countriesValue
            : (Object.values(countriesValue) as string[]);
        }
      }
    } catch (parseError) {
      console.error("Error parsing countries JSON:", parseError);
      countriesArray = null;
    }

    // Safely convert exchangeRate to string
    let exchangeRateStr = "1";
    try {
      const rate = result[0].exchangeRate;
      if (rate !== null && rate !== undefined) {
        exchangeRateStr = typeof rate === "string" ? rate : String(rate);
      }
    } catch {
      exchangeRateStr = "1";
    }

    return {
      success: true,
      data: {
        id: result[0].id,
        name: result[0].name,
        currency: result[0].currency,
        exchangeRate: exchangeRateStr,
        roundingRule: result[0].roundingRule,
        countries: countriesArray,
      },
    };
  } catch (error) {
    console.error("Error getting default market:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get default market",
    };
  }
}

/**
 * Get market by ID
 * This function can be called by any authenticated user to get market details
 */
export async function getMarket(marketId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    currency: string;
    exchangeRate: string;
    roundingRule: string | null;
    countries: string[] | null;
  };
  error?: string;
}> {
  try {
    // Verify user is authenticated
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    if (!marketId || typeof marketId !== "string") {
      return {
        success: false,
        error: "Invalid market ID",
      };
    }

    const result = await db
      .select({
        id: markets.id,
        name: markets.name,
        currency: markets.currency,
        exchangeRate: markets.exchangeRate,
        roundingRule: markets.roundingRule,
        countries: markets.countries,
      })
      .from(markets)
      .where(eq(markets.id, marketId))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Market not found",
      };
    }

    // Handle jsonb to array conversion safely
    let countriesArray: string[] | null = null;
    try {
      const countriesValue = result[0].countries;
      if (countriesValue) {
        if (Array.isArray(countriesValue)) {
          countriesArray = countriesValue;
        } else if (typeof countriesValue === "string") {
          const trimmed = String(countriesValue).trim();
          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            countriesArray = JSON.parse(trimmed);
          }
        }
      }
    } catch {
      countriesArray = null;
    }

    // Safely convert exchangeRate to string
    let exchangeRateStr = "1";
    try {
      const rate = result[0].exchangeRate;
      if (rate !== null && rate !== undefined) {
        exchangeRateStr = typeof rate === "string" ? rate : String(rate);
      }
    } catch {
      exchangeRateStr = "1";
    }

    return {
      success: true,
      data: {
        id: result[0].id,
        name: result[0].name,
        currency: result[0].currency,
        exchangeRate: exchangeRateStr,
        roundingRule: result[0].roundingRule,
        countries: countriesArray,
      },
    };
  } catch (error) {
    console.error("Error getting market:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get market",
    };
  }
}

/**
 * Find active market by country code
 */
export async function findActiveMarketByCountry(countryCode: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    currency: string;
    exchangeRate: string;
    roundingRule: string | null;
    countries: string[] | null;
  };
  error?: string;
}> {
  try {
    // Fetch all active markets and filter in JavaScript to avoid complex JSONB queries
    // This is safer and more reliable
    const allMarkets = await db
      .select({
        id: markets.id,
        name: markets.name,
        currency: markets.currency,
        exchangeRate: markets.exchangeRate,
        roundingRule: markets.roundingRule,
        countries: markets.countries,
      })
      .from(markets)
      .where(eq(markets.status, "active"));

    // Find market where country code is in countries array
    const result = allMarkets.filter((market) => {
      if (!market.countries) return false;

      try {
        // Handle jsonb - could be array, string, or already parsed
        let countriesArray: string[] | null = null;
        const countriesValue = market.countries;

        if (Array.isArray(countriesValue)) {
          countriesArray = countriesValue;
        } else if (typeof countriesValue === "string") {
          const trimmed = String(countriesValue).trim();
          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            countriesArray = JSON.parse(trimmed);
          } else {
            countriesArray = [trimmed];
          }
        } else if (typeof countriesValue === "object") {
          countriesArray = Array.isArray(countriesValue)
            ? countriesValue
            : (Object.values(countriesValue) as string[]);
        }

        return (
          Array.isArray(countriesArray) && countriesArray.includes(countryCode)
        );
      } catch {
        return false;
      }
    });

    if (result.length === 0) {
      return {
        success: false,
        error: "No active market found for country",
      };
    }

    const market = result[0];

    // Handle jsonb to array conversion safely
    let countriesArray: string[] | null = null;
    try {
      const countriesValue = market.countries;
      if (countriesValue) {
        if (Array.isArray(countriesValue)) {
          countriesArray = countriesValue;
        } else if (typeof countriesValue === "string") {
          const trimmed = String(countriesValue).trim();
          if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            countriesArray = JSON.parse(trimmed);
          } else {
            countriesArray = [trimmed];
          }
        } else if (typeof countriesValue === "object") {
          countriesArray = Array.isArray(countriesValue)
            ? countriesValue
            : (Object.values(countriesValue) as string[]);
        }
      }
    } catch (parseError) {
      console.error("Error parsing countries JSON:", parseError);
      countriesArray = null;
    }

    // Safely convert exchangeRate to string
    let exchangeRateStr = "1";
    try {
      const rate = market.exchangeRate;
      if (rate !== null && rate !== undefined) {
        exchangeRateStr = typeof rate === "string" ? rate : String(rate);
      }
    } catch {
      exchangeRateStr = "1";
    }

    return {
      success: true,
      data: {
        id: market.id,
        name: market.name,
        currency: market.currency,
        exchangeRate: exchangeRateStr,
        roundingRule: market.roundingRule,
        countries: countriesArray,
      },
    };
  } catch (error) {
    console.error("Error finding market by country:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to find market by country",
    };
  }
}

/**
 * Detect country from request headers (IP-based geolocation)
 * This is a simplified version - in production, use a proper geolocation service
 */
export async function detectCountryFromRequest(): Promise<string | null> {
  try {
    const headersList = await headers();
    // Try to get country from Cloudflare headers (if using Cloudflare)
    const country =
      headersList.get("cf-ipcountry") ||
      headersList.get("x-vercel-ip-country") ||
      headersList.get("x-country-code");

    if (country && country.length === 2) {
      return country.toUpperCase();
    }

    // Fallback: try to get from Accept-Language header (not ideal, but better than nothing)
    const acceptLanguage = headersList.get("accept-language");
    if (acceptLanguage) {
      // This is a very basic fallback - in production, use a proper IP geolocation service
      // For now, return null to use default market
      return null;
    }

    return null;
  } catch (error) {
    console.error("Error detecting country:", error);
    return null;
  }
}

/**
 * Auto-create a market for user based on country detection or default
 * Each user gets their own market record
 */
export async function autoAssignMarketToUser(userId: string): Promise<{
  success: boolean;
  marketId?: string;
  error?: string;
}> {
  try {
    // Check if user already has a market created
    const existingMarkets = await db
      .select({ id: markets.id })
      .from(markets)
      .where(eq(markets.createdBy, userId))
      .limit(1);

    if (existingMarkets.length > 0) {
      // User already has a market, just update their user record
      await db
        .update(user)
        .set({ marketId: existingMarkets[0].id })
        .where(eq(user.id, userId));

      return {
        success: true,
        marketId: existingMarkets[0].id,
      };
    }

    // Detect country from request
    const countryCode = await detectCountryFromRequest();

    // Get reference market to copy settings from
    let referenceMarket;
    if (countryCode) {
      // Try to find market by country
      const marketResult = await findActiveMarketByCountry(countryCode);
      if (marketResult.success && marketResult.data) {
        referenceMarket = marketResult.data;
      }
    }

    // If no market found by country, use default
    if (!referenceMarket) {
      const defaultMarketResult = await getDefaultMarket();
      if (defaultMarketResult.success && defaultMarketResult.data) {
        referenceMarket = defaultMarketResult.data;
      }
    }

    if (!referenceMarket) {
      // Create a default market if none exists
      const newMarketResult = await db
        .insert(markets)
        .values({
          name: "Europe",
          currency: "EUR",
          countries: [
            "AT",
            "BE",
            "BG",
            "HR",
            "CY",
            "CZ",
            "DK",
            "EE",
            "FI",
            "FR",
            "DE",
            "GR",
            "HU",
            "IE",
            "IT",
            "LV",
            "LT",
            "LU",
            "MT",
            "NL",
            "PL",
            "PT",
            "RO",
            "SK",
            "SI",
            "ES",
            "SE",
          ],
          exchangeRate: "1",
          roundingRule: "none",
          status: "active",
          isDefault: false,
          createdBy: userId,
        })
        .returning();

      const newMarket = Array.isArray(newMarketResult)
        ? newMarketResult[0]
        : newMarketResult;
      if (!newMarket || !newMarket.id) {
        return {
          success: false,
          error: "Failed to create market",
        };
      }

      await db
        .update(user)
        .set({ marketId: newMarket.id })
        .where(eq(user.id, userId));

      return {
        success: true,
        marketId: newMarket.id,
      };
    }

    // Create a new market for this user based on reference market
    const newMarketResult = await db
      .insert(markets)
      .values({
        name: referenceMarket.name,
        currency: referenceMarket.currency,
        countries: referenceMarket.countries,
        exchangeRate: referenceMarket.exchangeRate,
        roundingRule: referenceMarket.roundingRule || "none",
        status: "active",
        isDefault: false,
        createdBy: userId,
      })
      .returning();

    const newMarket = Array.isArray(newMarketResult)
      ? newMarketResult[0]
      : newMarketResult;
    if (!newMarket || !newMarket.id) {
      return {
        success: false,
        error: "Failed to create market",
      };
    }

    // Update user with their new market
    await db
      .update(user)
      .set({ marketId: newMarket.id })
      .where(eq(user.id, userId));

    return {
      success: true,
      marketId: newMarket.id,
    };
  } catch (error) {
    console.error("Error auto-assigning market:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to auto-assign market",
    };
  }
}

/**
 * Get markets for current user
 */
export async function getMarketsForUser(): Promise<{
  success: boolean;
  markets?: Array<{
    id: string;
    name: string;
    currency: string;
    isDefault: boolean;
  }>;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get all active markets
    const allMarkets = await db
      .select({
        id: markets.id,
        name: markets.name,
        currency: markets.currency,
        isDefault: markets.isDefault,
      })
      .from(markets)
      .where(eq(markets.status, "active"))
      .orderBy(desc(markets.isDefault), asc(markets.name));

    return {
      success: true,
      markets: allMarkets.map((m) => ({
        id: m.id,
        name: m.name,
        currency: m.currency,
        isDefault: m.isDefault || false,
      })),
    };
  } catch (error) {
    console.error("Error getting markets for user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get markets",
    };
  }
}
