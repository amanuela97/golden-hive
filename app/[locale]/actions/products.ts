"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createListing,
  updateListing,
  deleteListing,
  toggleListingStatus,
  toggleListingFeatured,
  type CreateListingData,
  type UpdateListingData,
} from "@/lib/listing";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { listing, userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

export async function createProductAction(data: CreateListingData) {
  try {
    const user = await getCurrentUser();

    // Check store setup for sellers
    const { getStoreIdForUser } = await import("./store-members");
    const { storeId, isAdmin, error: storeError } = await getStoreIdForUser();

    if (storeError) {
      return { success: false, error: storeError };
    }

    if (!isAdmin && !storeId) {
      return {
        success: false,
        error: "Store not found. Please set up your store first in Settings > Store to add products.",
      };
    }

    const product = await createListing({
      ...data,
      producerId: user.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");

    return { success: true, product };
  } catch (error) {
    console.error("Error creating product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create product",
    };
  }
}

export async function updateProductAction(data: UpdateListingData) {
  try {
    const user = await getCurrentUser();

    // Verify the product belongs to the current user
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(data.id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    if (existingProduct.producerId !== user.id) {
      return { success: false, error: "Unauthorized" };
    }

    const product = await updateListing(data);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${data.id}`);

    return { success: true, product };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update product",
    };
  }
}

export async function adminUpdateProductAction(data: UpdateListingData) {
  try {
    // Admin can update any product, no ownership check needed
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(data.id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    const product = await updateListing(data);

    revalidatePath("/dashboard/admin/products");
    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${data.id}`);

    return { success: true, product };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update product",
    };
  }
}

export async function deleteProductAction(id: string) {
  try {
    const user = await getCurrentUser();

    // Verify the product belongs to the current user
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    if (existingProduct.producerId !== user.id) {
      return { success: false, error: "Unauthorized" };
    }

    await deleteListing(id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");

    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
}

export async function adminDeleteProductAction(id: string) {
  try {
    // Admin can delete any product, no ownership check needed
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    await deleteListing(id);

    revalidatePath("/dashboard/admin/products");
    revalidatePath("/dashboard/products");

    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
}

export async function toggleProductStatusAction(id: string) {
  try {
    const user = await getCurrentUser();

    // Verify the product belongs to the current user
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    if (existingProduct.producerId !== user.id) {
      return { success: false, error: "Unauthorized" };
    }

    const product = await toggleListingStatus(id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");

    return { success: true, product };
  } catch (error) {
    console.error("Error toggling product status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle product status",
    };
  }
}

export async function toggleProductFeaturedAction(id: string) {
  try {
    const user = await getCurrentUser();

    // Only admins can toggle featured status
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's role
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    if (userRole.length === 0) {
      return { success: false, error: "Unauthorized" };
    }

    const roleName = userRole[0].roleName.toLowerCase();

    if (roleName !== "admin") {
      return { success: false, error: "Only admins can toggle featured status" };
    }

    // Verify the product exists
    const { getListingById } = await import("@/lib/listing");
    const existingProduct = await getListingById(id);

    if (!existingProduct) {
      return { success: false, error: "Product not found" };
    }

    const product = await toggleListingFeatured(id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");

    return { success: true, product };
  } catch (error) {
    console.error("Error toggling product featured status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle product featured status",
    };
  }
}

// CSV Export functionality
export async function exportListingsToCSVAction(selectedIds?: string[]) {
  try {
    const user = await getCurrentUser();

    // Get listings for the current user
    let listings;

    if (selectedIds && selectedIds.length > 0) {
      const { inArray, and } = await import("drizzle-orm");
      listings = await db
        .select()
        .from(listing)
        .where(
          and(eq(listing.producerId, user.id), inArray(listing.id, selectedIds))
        );
    } else {
      listings = await db
        .select()
        .from(listing)
        .where(eq(listing.producerId, user.id));
    }

    // Convert to CSV format dynamically based on Listing type
    if (listings.length === 0) {
      return {
        success: true,
        csvContent: "",
        filename: `listings_${new Date().toISOString().split("T")[0]}.csv`,
      };
    }

    // Get headers from the first listing object
    const csvHeaders = Object.keys(listings[0]);

    // Convert each listing to CSV row
    const csvRows = listings.map((listing) => {
      return csvHeaders.map((header) => {
        const value = listing[header as keyof typeof listing];

        // Handle different data types for CSV export
        if (value === null || value === undefined) {
          return "";
        }

        if (value instanceof Date) {
          return value.toISOString().split("T")[0]; // Format dates as YYYY-MM-DD
        }

        if (typeof value === "boolean") {
          return value ? "true" : "false";
        }

        if (Array.isArray(value)) {
          return JSON.stringify(value); // Convert arrays to JSON strings
        }

        return String(value);
      });
    });

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return {
      success: true,
      csvContent,
      filename: `listings_${new Date().toISOString().split("T")[0]}.csv`,
    };
  } catch (error) {
    console.error("Error exporting listings to CSV:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to export listings",
    };
  }
}

// CSV Import functionality
export async function importListingsFromCSVAction(csvContent: string) {
  try {
    const user = await getCurrentUser();

    // Parse CSV content
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      return {
        success: false,
        error: "CSV file must contain at least a header and one data row",
      };
    }

    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const dataRows = lines.slice(1);

    // Define expected fields and their types for validation
    const expectedFields = {
      name: "string",
      price: "number",
      currency: "string",
      stockQuantity: "number",
      unit: "string",
      isActive: "boolean",
      isFeatured: "boolean",
      originVillage: "string",
      harvestDate: "date",
      ratingAverage: "number",
      ratingCount: "number",
      salesCount: "number",
      description: "string",
      category: "string",
      gallery: "array",
    };

    const importedListings = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const values = dataRows[i]
          .split(",")
          .map((v) => v.replace(/"/g, "").trim());

        if (values.length !== headers.length) {
          errors.push(`Row ${i + 2}: Column count mismatch`);
          continue;
        }

        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });

        // Validate required fields
        if (!rowData.name || !rowData.price) {
          errors.push(`Row ${i + 2}: Name and price are required`);
          continue;
        }

        // Convert and validate data types dynamically
        const listingData: Record<
          string,
          string | number | boolean | Date | string[] | null
        > = {
          id: crypto.randomUUID(), // Generate UUID for new listing
          producerId: user.id,
        };

        // Process each field dynamically
        headers.forEach((header) => {
          const value = rowData[header];
          const fieldType =
            expectedFields[header as keyof typeof expectedFields];

          if (value === "" || value === null || value === undefined) {
            // Set appropriate default values based on field type
            if (fieldType === "number") {
              listingData[header] = 0;
            } else if (fieldType === "boolean") {
              listingData[header] = false;
            } else if (fieldType === "array") {
              listingData[header] = [];
            } else {
              listingData[header] = null;
            }
            return;
          }

          // Convert based on expected type
          switch (fieldType) {
            case "number":
              const numValue = parseFloat(value);
              if (isNaN(numValue)) {
                errors.push(
                  `Row ${i + 2}: Invalid number value for ${header}: ${value}`
                );
                return;
              }
              // For numeric fields in database, convert to string
              if (header === "price" || header === "ratingAverage") {
                listingData[header] = numValue.toString();
              } else {
                listingData[header] = Math.round(numValue);
              }
              break;

            case "boolean":
              listingData[header] = value === "true";
              break;

            case "date":
              const dateValue = new Date(value);
              if (isNaN(dateValue.getTime())) {
                errors.push(
                  `Row ${i + 2}: Invalid date value for ${header}: ${value}`
                );
                return;
              }
              listingData[header] = dateValue;
              break;

            case "array":
              try {
                listingData[header] = JSON.parse(value);
              } catch {
                listingData[header] = [value]; // Treat as single item array
              }
              break;

            case "string":
            default:
              listingData[header] = value;
              break;
          }
        });

        // Use the existing createListing function to handle proper type conversion
        const { createListing } = await import("@/lib/listing");
        const newListing = await createListing({
          name: listingData.name as string,
          description: listingData.description as string,
          category: listingData.category as string,
          price: parseFloat(listingData.price as string),
          currency: listingData.currency as string,
          stockQuantity: listingData.stockQuantity as number,
          unit: listingData.unit as string,
          producerId: user.id,
          isActive: listingData.isActive as boolean,
          isFeatured: listingData.isFeatured as boolean,
          originVillage: listingData.originVillage as string,
          harvestDate: listingData.harvestDate as Date,
          imageUrl: listingData.imageUrl as string,
          gallery: listingData.gallery as string[],
        });
        importedListings.push(newListing);
      } catch (error) {
        errors.push(
          `Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    revalidatePath("/dashboard/products");

    return {
      success: true,
      importedCount: importedListings.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      listings: importedListings,
    };
  } catch (error) {
    console.error("Error importing listings from CSV:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to import listings",
    };
  }
}
