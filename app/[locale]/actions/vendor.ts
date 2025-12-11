"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import { vendor, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFile } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";

export interface VendorData {
  storeName: string;
  logoUrl?: string | null;
  description?: string | null;
}

/**
 * Get vendor by owner user ID
 */
export async function getVendorByOwnerId(
  ownerUserId: string
): Promise<ActionResponse & { result?: VendorData & { id: string } }> {
  try {
    const result = await db
      .select()
      .from(vendor)
      .where(eq(vendor.ownerUserId, ownerUserId))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Vendor not found",
      };
    }

    return {
      success: true,
      result: {
        id: result[0].id,
        storeName: result[0].storeName,
        logoUrl: result[0].logoUrl,
        description: result[0].description,
      },
    };
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch vendor",
    };
  }
}

/**
 * Get vendor by current user
 */
export async function getVendor(): Promise<
  ActionResponse & { result?: VendorData & { id: string } }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    return await getVendorByOwnerId(session.user.id);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch vendor",
    };
  }
}

/**
 * Create or update vendor
 */
export async function upsertVendor(
  data: VendorData,
  logoFile?: File
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const currentUser = session.user;
    const isAdmin = process.env.ADMIN_LIST?.split(",").includes(
      currentUser.email || ""
    );

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile) {
      logoUrl = await uploadFile(logoFile, `vendor_logos/${currentUser.id}`);
    }

    // Check if vendor exists
    const existingVendor = await db
      .select()
      .from(vendor)
      .where(eq(vendor.ownerUserId, currentUser.id))
      .limit(1);

    const vendorData = {
      storeName: data.storeName.trim(),
      logoUrl: logoUrl || data.logoUrl || null,
      description: data.description?.trim() || null,
      updatedAt: new Date(),
    };

    if (existingVendor.length > 0) {
      // Update existing vendor
      await db
        .update(vendor)
        .set(vendorData)
        .where(eq(vendor.ownerUserId, currentUser.id));
    } else {
      // Create new vendor
      await db.insert(vendor).values({
        ...vendorData,
        ownerUserId: currentUser.id,
      });
    }

    // If user is admin, update/create vendor for all admins
    if (isAdmin) {
      const adminEmails = process.env.ADMIN_LIST?.split(",") || [];

      // For each admin email, get or create user and vendor
      for (const adminEmail of adminEmails) {
        const adminUser = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, adminEmail.trim()))
          .limit(1);

        if (adminUser.length > 0) {
          const adminUserId = adminUser[0].id;
          const adminVendor = await db
            .select()
            .from(vendor)
            .where(eq(vendor.ownerUserId, adminUserId))
            .limit(1);

          // Upload logo for each admin if provided
          let adminLogoUrl: string | null = null;
          if (logoFile) {
            adminLogoUrl = await uploadFile(
              logoFile,
              `vendor_logos/${adminUserId}`
            );
          }

          if (adminVendor.length > 0) {
            // Update existing vendor
            await db
              .update(vendor)
              .set({
                storeName: data.storeName.trim(),
                logoUrl: adminLogoUrl || data.logoUrl || null,
                description: data.description?.trim() || null,
                updatedAt: new Date(),
              })
              .where(eq(vendor.ownerUserId, adminUserId));
          } else {
            // Create new vendor
            await db.insert(vendor).values({
              storeName: data.storeName.trim(),
              logoUrl: adminLogoUrl || data.logoUrl || null,
              description: data.description?.trim() || null,
              ownerUserId: adminUserId,
            });
          }
        }
      }
    }

    revalidatePath("/dashboard/settings/vendor");

    return {
      success: true,
      message: "Vendor updated successfully",
    };
  } catch (error) {
    console.error("Error upserting vendor:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update vendor",
    };
  }
}

