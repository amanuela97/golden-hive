import { syncCategoriesFromTaxonomy } from "@/app/[locale]/actions/categories";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  try {
    // Check if user is admin

    // TODO: Add admin check if you have admin roles
    // For now, allow any authenticated user to sync

    const result = await syncCategoriesFromTaxonomy();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${result.count} categories`,
        count: result.count,
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to sync categories" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error syncing categories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
