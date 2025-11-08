"use server";

import { db } from "@/db";
import { shippingBillingInfo } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ActionResponse } from "@/lib/types";

interface ShippingBillingData {
  // Billing
  billingFirstName?: string | null;
  billingLastName?: string | null;
  billingCompany?: string | null;
  billingCountry?: string | null;
  billingAddress?: string | null;
  billingAddress2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  billingPhone?: string | null;
  billingEmail?: string | null;
  // Shipping
  shippingFirstName?: string | null;
  shippingLastName?: string | null;
  shippingCompany?: string | null;
  shippingCountry?: string | null;
  shippingAddress?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
}

async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  return session.user;
}

export async function saveShippingBillingInfo(
  data: ShippingBillingData
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "You must be logged in to save this information",
      };
    }

    // Check if user already has saved info
    const existing = await db
      .select()
      .from(shippingBillingInfo)
      .where(eq(shippingBillingInfo.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(shippingBillingInfo)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(shippingBillingInfo.userId, user.id));

      return {
        success: true,
        message: "Shipping and billing information updated successfully",
      };
    } else {
      // Create new
      await db.insert(shippingBillingInfo).values({
        userId: user.id,
        ...data,
      });

      return {
        success: true,
        message: "Shipping and billing information saved successfully",
      };
    }
  } catch (error) {
    console.error("Save shipping/billing info error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save shipping and billing information",
    };
  }
}

export async function getShippingBillingInfo(): Promise<
  ActionResponse & { result?: ShippingBillingData }
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "You must be logged in to retrieve this information",
        result: undefined,
      };
    }

    const info = await db
      .select()
      .from(shippingBillingInfo)
      .where(eq(shippingBillingInfo.userId, user.id))
      .limit(1);

    if (info.length === 0) {
      return {
        success: true,
        message: "No saved information found",
        result: undefined,
      };
    }

    const result: ShippingBillingData = {
      billingFirstName: info[0].billingFirstName,
      billingLastName: info[0].billingLastName,
      billingCompany: info[0].billingCompany,
      billingCountry: info[0].billingCountry,
      billingAddress: info[0].billingAddress,
      billingAddress2: info[0].billingAddress2,
      billingCity: info[0].billingCity,
      billingState: info[0].billingState,
      billingZip: info[0].billingZip,
      billingPhone: info[0].billingPhone,
      billingEmail: info[0].billingEmail,
      shippingFirstName: info[0].shippingFirstName,
      shippingLastName: info[0].shippingLastName,
      shippingCompany: info[0].shippingCompany,
      shippingCountry: info[0].shippingCountry,
      shippingAddress: info[0].shippingAddress,
      shippingAddress2: info[0].shippingAddress2,
      shippingCity: info[0].shippingCity,
      shippingState: info[0].shippingState,
      shippingZip: info[0].shippingZip,
    };

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Get shipping/billing info error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to retrieve shipping and billing information",
      result: undefined,
    };
  }
}
