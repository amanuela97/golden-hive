/**
 * Utility functions for generating order numbers
 */

import { db } from "@/db";
import { orders, draftOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Generate a unique order number in the format: GM-YYYY-XXXXXX
 * Format: GM-2025-000234 (prefix-year-6digit)
 */
export async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  
  // Try up to 50 times to find a unique number
  for (let i = 0; i < 50; i++) {
    // Generate 6-digit random number (100000-999999)
    const random = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `GM-${year}-${random.toString().padStart(6, "0")}`;
    
    // Check if this order number already exists
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    
    if (existing.length === 0) {
      return orderNumber;
    }
  }
  
  // Fallback: append timestamp if all variations are taken
  const timestamp = Date.now().toString().slice(-6);
  return `GM-${year}-${timestamp}`;
}

/**
 * Generate a unique draft order number in the format: GM-DRAFT-YYYY-XXXXXX
 * Format: GM-DRAFT-2025-000234 (prefix-draft-year-6digit)
 */
export async function generateDraftOrderNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  
  // Try up to 50 times to find a unique number
  for (let i = 0; i < 50; i++) {
    // Generate 6-digit random number (100000-999999)
    const random = Math.floor(100000 + Math.random() * 900000);
    const draftNumber = `GM-DRAFT-${year}-${random.toString().padStart(6, "0")}`;
    
    // Check if this draft number already exists
    const existing = await db
      .select({ id: draftOrders.id })
      .from(draftOrders)
      .where(eq(draftOrders.draftNumber, draftNumber))
      .limit(1);
    
    if (existing.length === 0) {
      return draftNumber;
    }
  }
  
  // Fallback: append timestamp if all variations are taken
  const timestamp = Date.now().toString().slice(-6);
  return `GM-DRAFT-${year}-${timestamp}`;
}

