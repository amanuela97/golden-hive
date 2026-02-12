import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Platform hold period in days (from env HOLD_PERIOD_DAYS). Used for payouts and balance.
 * Default 7 when unset.
 */
export function getHoldPeriodDays(): number {
  const v = process.env.HOLD_PERIOD_DAYS;
  if (v === undefined || v === "") return 7;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 7 : n;
}

/**
 * Format currency amount with proper symbol and decimal places
 */
export function formatCurrency(
  amount: number,
  currency: string = "EUR"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
