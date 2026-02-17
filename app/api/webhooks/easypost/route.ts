import { NextResponse } from "next/server";

/**
 * EasyPost webhook endpoint deprecated.
 * Shipping is now via EasyShip. This route returns 200 for backward compatibility.
 * Configure EasyShip webhooks in EasyShip dashboard when needed for tracking updates.
 */
export async function POST() {
  return NextResponse.json({ received: true });
}
