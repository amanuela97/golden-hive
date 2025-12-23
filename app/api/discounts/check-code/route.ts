import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discounts } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const excludeId = searchParams.get("excludeId");

    if (!code) {
      return NextResponse.json(
        { error: "Code parameter is required" },
        { status: 400 }
      );
    }

    // Check if code exists
    const conditions = [eq(discounts.code, code)];
    
    // Exclude current discount if editing
    if (excludeId) {
      conditions.push(ne(discounts.id, excludeId));
    }

    const existing = await db
      .select()
      .from(discounts)
      .where(and(...conditions))
      .limit(1);

    return NextResponse.json({ exists: existing.length > 0 });
  } catch (error) {
    console.error("Error checking discount code:", error);
    return NextResponse.json(
      { error: "Failed to check code" },
      { status: 500 }
    );
  }
}

