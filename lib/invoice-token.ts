import { nanoid } from "nanoid";

/**
 * Generate a secure token for invoice payment links
 */
export function generateInvoiceToken(): string {
  // Generate a URL-safe token (32 characters)
  return nanoid(32);
}

/**
 * Calculate invoice expiration date (default: 30 days)
 */
export function getInvoiceExpirationDate(days: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

