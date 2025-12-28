/**
 * Utilities for managing guest favorites in localStorage
 * Favorites expire after 7 days
 */

const GUEST_FAVORITES_KEY = "golden-marketplace-guest-favorites";
const EXPIRY_DAYS = 7;

export interface GuestFavorite {
  type: "product" | "store";
  id: string;
  addedAt: number; // timestamp
}

interface GuestFavoritesData {
  products: GuestFavorite[];
  stores: GuestFavorite[];
  expiresAt: number; // timestamp
}

/**
 * Get all guest favorites from localStorage
 */
export function getGuestFavorites(): {
  products: GuestFavorite[];
  stores: GuestFavorite[];
} {
  if (typeof window === "undefined") {
    return { products: [], stores: [] };
  }

  try {
    const stored = localStorage.getItem(GUEST_FAVORITES_KEY);
    if (!stored) {
      return { products: [], stores: [] };
    }

    const data: GuestFavoritesData = JSON.parse(stored);

    // Check if expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(GUEST_FAVORITES_KEY);
      return { products: [], stores: [] };
    }

    return {
      products: data.products || [],
      stores: data.stores || [],
    };
  } catch (error) {
    console.error("Error reading guest favorites:", error);
    return { products: [], stores: [] };
  }
}

/**
 * Add a favorite (product or store)
 */
export function addGuestFavorite(type: "product" | "store", id: string): void {
  if (typeof window === "undefined") return;

  try {
    const current = getGuestFavorites();
    const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const favorite: GuestFavorite = {
      type,
      id,
      addedAt: Date.now(),
    };

    if (type === "product") {
      // Remove if already exists
      const filtered = current.products.filter((f) => f.id !== id);
      const data: GuestFavoritesData = {
        products: [...filtered, favorite],
        stores: current.stores,
        expiresAt,
      };
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(data));
    } else {
      // Remove if already exists
      const filtered = current.stores.filter((f) => f.id !== id);
      const data: GuestFavoritesData = {
        products: current.products,
        stores: [...filtered, favorite],
        expiresAt,
      };
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error adding guest favorite:", error);
  }
}

/**
 * Remove a favorite (product or store)
 */
export function removeGuestFavorite(
  type: "product" | "store",
  id: string
): void {
  if (typeof window === "undefined") return;

  try {
    const current = getGuestFavorites();
    const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (type === "product") {
      const data: GuestFavoritesData = {
        products: current.products.filter((f) => f.id !== id),
        stores: current.stores,
        expiresAt,
      };
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(data));
    } else {
      const data: GuestFavoritesData = {
        products: current.products,
        stores: current.stores.filter((f) => f.id !== id),
        expiresAt,
      };
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error removing guest favorite:", error);
  }
}

/**
 * Check if an item is favorited
 */
export function isGuestFavorite(type: "product" | "store", id: string): boolean {
  const favorites = getGuestFavorites();
  if (type === "product") {
    return favorites.products.some((f) => f.id === id);
  } else {
    return favorites.stores.some((f) => f.id === id);
  }
}

/**
 * Clear all guest favorites
 */
export function clearGuestFavorites(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_FAVORITES_KEY);
}

/**
 * Get expiry date as a readable string
 */
export function getExpiryDate(): string {
  const stored = localStorage.getItem(GUEST_FAVORITES_KEY);
  if (!stored) return "";

  try {
    const data: GuestFavoritesData = JSON.parse(stored);
    return new Date(data.expiresAt).toLocaleDateString();
  } catch {
    return "";
  }
}

