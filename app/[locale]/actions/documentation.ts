"use server";

import { db } from "@/db";
import {
  documentationType,
  categoryRules,
  categoryRulesDocumentation,
  sellerDocumentation,
  user,
  type DocumentationType,
  type SellerDocumentation,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { revalidatePath } from "next/cache";
import {
  uploadFileWithResult,
  deleteFileByPublicId,
  deleteFilesByPublicIds,
} from "@/lib/cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

/**
 * Get all required documentation types for a given category rule
 * @deprecated Use checkSellerDocumentationForCategory with taxonomyCategoryId instead
 */
export async function getRequiredDocumentsForCategory(
  categoryRuleId: string
): Promise<ActionResponse & { result?: DocumentationType[] }> {
  try {
    const requiredDocs = await db
      .select({
        id: documentationType.id,
        name: documentationType.name,
        description: documentationType.description,
        exampleUrl: documentationType.exampleUrl,
        createdAt: documentationType.createdAt,
        updatedAt: documentationType.updatedAt,
      })
      .from(categoryRulesDocumentation)
      .innerJoin(
        documentationType,
        eq(categoryRulesDocumentation.documentationTypeId, documentationType.id)
      )
      .where(eq(categoryRulesDocumentation.categoryRuleId, categoryRuleId));

    return {
      success: true,
      result: requiredDocs,
    };
  } catch (error) {
    console.error("Error fetching required documents:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch required documents",
    };
  }
}

/**
 * Get all documents uploaded by a seller, including status and type
 */
export async function getSellerDocuments(
  sellerId: string
): Promise<ActionResponse & { result?: SellerDocumentation[] }> {
  try {
    const docs = await db
      .select({
        id: sellerDocumentation.id,
        sellerId: sellerDocumentation.sellerId,
        documentationTypeId: sellerDocumentation.documentationTypeId,
        documentUrl: sellerDocumentation.documentUrl,
        cloudinaryPublicId: sellerDocumentation.cloudinaryPublicId,
        status: sellerDocumentation.status,
        submittedAt: sellerDocumentation.submittedAt,
        reviewedAt: sellerDocumentation.reviewedAt,
        createdAt: sellerDocumentation.createdAt,
        updatedAt: sellerDocumentation.updatedAt,
      })
      .from(sellerDocumentation)
      .where(eq(sellerDocumentation.sellerId, sellerId));

    return {
      success: true,
      result: docs,
    };
  } catch (error) {
    console.error("Error fetching seller documents:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch seller documents",
    };
  }
}

/**
 * Get all documentation types with seller's upload status
 */
export async function getDocumentationTypesWithStatus(
  sellerId: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      name: string;
      description: string | null;
      exampleUrl: string | null;
      status: "not_uploaded" | "pending" | "approved" | "rejected";
      documentUrl?: string;
      submittedAt?: Date;
      reviewedAt?: Date;
    }>;
  }
> {
  try {
    // Get all documentation types
    const allTypes = await db.select().from(documentationType);

    // Get seller's uploaded documents
    const sellerDocs = await db
      .select()
      .from(sellerDocumentation)
      .where(eq(sellerDocumentation.sellerId, sellerId));

    // Combine the data
    const result = allTypes.map((type) => {
      const sellerDoc = sellerDocs.find(
        (doc) => doc.documentationTypeId === type.id
      );

      return {
        id: type.id,
        name: type.name,
        description: type.description,
        exampleUrl: type.exampleUrl,
        status: sellerDoc
          ? (sellerDoc.status as "pending" | "approved" | "rejected")
          : ("not_uploaded" as const),
        documentUrl: sellerDoc?.documentUrl,
        submittedAt: sellerDoc?.submittedAt || undefined,
        reviewedAt: sellerDoc?.reviewedAt || undefined,
      };
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("Error fetching documentation types with status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch documentation types",
    };
  }
}

/**
 * Upload seller documentation
 */
export async function uploadSellerDocumentation(
  formData: FormData
): Promise<ActionResponse> {
  try {
    const sellerId = formData.get("sellerId") as string;
    const documentationTypeId = formData.get("documentationTypeId") as string;
    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    if (!sellerId || !documentationTypeId) {
      return {
        success: false,
        error: "Missing required fields",
      };
    }

    // Upload to Cloudinary
    const uploadResult = await uploadFileWithResult(
      file,
      `listings/documents/${sellerId}`
    );

    // Store in database
    await db
      .insert(sellerDocumentation)
      .values({
        sellerId,
        documentationTypeId,
        documentUrl: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: [
          sellerDocumentation.sellerId,
          sellerDocumentation.documentationTypeId,
        ],
        set: {
          documentUrl: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
          status: "pending",
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    revalidatePath("/dashboard/seller/documentation");
    revalidatePath("/dashboard/admin/documentation");

    return {
      success: true,
      message: "Document uploaded successfully",
    };
  } catch (error) {
    console.error("Error uploading document:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

/**
 * Review seller documentation (approve/reject)
 */
export async function reviewSellerDocumentation(
  docId: string,
  action: "approve" | "reject"
): Promise<ActionResponse> {
  try {
    await db
      .update(sellerDocumentation)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sellerDocumentation.id, docId));

    revalidatePath("/dashboard/admin/documentation");
    revalidatePath("/dashboard/seller/documentation");

    return {
      success: true,
      message: `Document ${action}d successfully`,
    };
  } catch (error) {
    console.error("Error reviewing document:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to review document",
    };
  }
}

/**
 * Admin: Update seller documentation (for editing document details)
 */
export async function adminUpdateSellerDocumentation(
  docId: string,
  data: {
    status?: "pending" | "approved" | "rejected";
    reviewedAt?: Date | null;
  }
): Promise<ActionResponse> {
  try {
    await db
      .update(sellerDocumentation)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(sellerDocumentation.id, docId));

    revalidatePath("/dashboard/admin/documentation");
    revalidatePath("/dashboard/seller/documentation");

    return {
      success: true,
      message: "Document updated successfully",
    };
  } catch (error) {
    console.error("Error updating document:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update document",
    };
  }
}

/**
 * Admin: Delete seller documentation
 */
export async function adminDeleteSellerDocumentation(
  docId: string
): Promise<ActionResponse> {
  try {
    // Get document details first to delete from Cloudinary
    const doc = await db
      .select()
      .from(sellerDocumentation)
      .where(eq(sellerDocumentation.id, docId))
      .limit(1);

    if (doc.length === 0) {
      return {
        success: false,
        error: "Document not found",
      };
    }

    // Delete from Cloudinary if public_id exists
    if (doc[0].cloudinaryPublicId) {
      try {
        await deleteFileByPublicId(doc[0].cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn("Failed to delete from Cloudinary:", cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }

    // Delete from database
    await db
      .delete(sellerDocumentation)
      .where(eq(sellerDocumentation.id, docId));

    revalidatePath("/dashboard/admin/documentation");
    revalidatePath("/dashboard/seller/documentation");

    return {
      success: true,
      message: "Document deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting document:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete document",
    };
  }
}

/**
 * Get all submitted documents for admin review
 */
export async function getAllSubmittedDocuments(): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      sellerId: string;
      sellerName: string;
      sellerEmail: string;
      documentationTypeId: string;
      documentTypeName: string;
      documentUrl: string;
      status: string;
      submittedAt: Date;
      reviewedAt: Date | null;
    }>;
  }
> {
  try {
    const docs = await db
      .select({
        id: sellerDocumentation.id,
        sellerId: sellerDocumentation.sellerId,
        documentUrl: sellerDocumentation.documentUrl,
        status: sellerDocumentation.status,
        submittedAt: sellerDocumentation.submittedAt,
        reviewedAt: sellerDocumentation.reviewedAt,
        documentTypeName: documentationType.name,
        documentationTypeId: documentationType.id,
        sellerName: user.name,
        sellerEmail: user.email,
      })
      .from(sellerDocumentation)
      .innerJoin(
        documentationType,
        eq(sellerDocumentation.documentationTypeId, documentationType.id)
      )
      .innerJoin(user, eq(sellerDocumentation.sellerId, user.id))
      .orderBy(sellerDocumentation.submittedAt);

    return {
      success: true,
      result: docs.map((doc) => ({
        ...doc,
        status: doc.status || "pending",
        submittedAt: doc.submittedAt || new Date(),
      })),
    };
  } catch (error) {
    console.error("Error fetching all submitted documents:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch documents",
    };
  }
}

/**
 * Delete seller documents when account is removed
 */
export async function deleteSellerDocumentsOnAccountRemoval(
  sellerId: string
): Promise<ActionResponse> {
  try {
    // Get all documents for the seller
    const docs = await db
      .select({ publicId: sellerDocumentation.cloudinaryPublicId })
      .from(sellerDocumentation)
      .where(eq(sellerDocumentation.sellerId, sellerId));

    // Delete from Cloudinary
    if (docs.length > 0) {
      const publicIds = docs.map((doc) => doc.publicId);
      await deleteFilesByPublicIds(publicIds);
    }

    // Delete from database (cascade should handle this, but let's be explicit)
    await db
      .delete(sellerDocumentation)
      .where(eq(sellerDocumentation.sellerId, sellerId));

    return {
      success: true,
      message: "Seller documents deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting seller documents:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete documents",
    };
  }
}

/**
 * Check if seller has all required documents for a taxonomy category
 * Now uses taxonomyCategoryId to look up rules in category_rules table
 */
export async function checkSellerDocumentationForCategory(
  sellerId: string,
  taxonomyCategoryId: string
): Promise<
  ActionResponse & {
    result?: {
      hasAllRequired: boolean;
      missingDocuments: DocumentationType[];
      approvedDocuments: DocumentationType[];
    };
  }
> {
  try {
    // Check if this taxonomy category requires documentation
    const rule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.taxonomyCategoryId, taxonomyCategoryId))
      .limit(1);

    // If no rule exists or documentation is not required, return success
    if (rule.length === 0 || !rule[0].requiresDocumentation) {
      return {
        success: true,
        result: {
          hasAllRequired: true,
          missingDocuments: [],
          approvedDocuments: [],
        },
      };
    }

    // Get required documentation types for this taxonomy category
    const requiredDocs = await db
      .select({
        id: documentationType.id,
        name: documentationType.name,
        description: documentationType.description,
        exampleUrl: documentationType.exampleUrl,
        createdAt: documentationType.createdAt,
        updatedAt: documentationType.updatedAt,
      })
      .from(categoryRulesDocumentation)
      .innerJoin(
        documentationType,
        eq(categoryRulesDocumentation.documentationTypeId, documentationType.id)
      )
      .where(eq(categoryRulesDocumentation.categoryRuleId, rule[0].id));

    if (requiredDocs.length === 0) {
      return {
        success: true,
        result: {
          hasAllRequired: true,
          missingDocuments: [],
          approvedDocuments: [],
        },
      };
    }

    // Get seller's approved documents
    const sellerDocsResult = await getSellerDocuments(sellerId);
    if (!sellerDocsResult.success || !sellerDocsResult.result) {
      return {
        success: false,
        error: "Failed to fetch seller documents",
      };
    }

    const approvedDocs = sellerDocsResult.result.filter(
      (doc) => doc.status === "approved"
    );

    // Find missing documents
    const missingDocs = requiredDocs.filter(
      (req) =>
        !approvedDocs.some(
          (approved) => approved.documentationTypeId === req.id
        )
    );

    const hasAllRequired = missingDocs.length === 0;

    return {
      success: true,
      result: {
        hasAllRequired,
        missingDocuments: missingDocs,
        approvedDocuments: requiredDocs.filter((req) =>
          approvedDocs.some(
            (approved) => approved.documentationTypeId === req.id
          )
        ),
      },
    };
  } catch (error) {
    console.error("Error checking seller documentation:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to check documentation",
    };
  }
}

// ===== DOCUMENTATION TYPE CRUD OPERATIONS =====

/**
 * Get all documentation types
 */
export async function getAllDocumentationTypes(): Promise<
  ActionResponse & {
    result?: DocumentationType[];
  }
> {
  try {
    const types = await db
      .select()
      .from(documentationType)
      .orderBy(documentationType.name);

    return {
      success: true,
      result: types,
    };
  } catch (error) {
    console.error("Error fetching documentation types:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch documentation types",
    };
  }
}

/**
 * Create a new documentation type
 */
export async function createDocumentationType(data: {
  name: string;
  description?: string;
  exampleUrl?: string;
}): Promise<ActionResponse & { result?: DocumentationType }> {
  try {
    if (!data.name.trim()) {
      return {
        success: false,
        error: "Documentation type name is required",
      };
    }

    // Check if name already exists
    const existing = await db
      .select()
      .from(documentationType)
      .where(eq(documentationType.name, data.name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "A documentation type with this name already exists",
      };
    }

    const newType = await db
      .insert(documentationType)
      .values({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        exampleUrl: data.exampleUrl?.trim() || null,
      })
      .returning();

    revalidatePath("/dashboard/admin/documentation");

    return {
      success: true,
      result: newType[0],
      message: "Documentation type created successfully",
    };
  } catch (error) {
    console.error("Error creating documentation type:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create documentation type",
    };
  }
}

/**
 * Update a documentation type
 */
export async function updateDocumentationType(
  id: string,
  data: {
    name?: string;
    description?: string;
    exampleUrl?: string;
  }
): Promise<ActionResponse & { result?: DocumentationType }> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Documentation type ID is required",
      };
    }

    // Check if documentation type exists
    const existing = await db
      .select()
      .from(documentationType)
      .where(eq(documentationType.id, id))
      .limit(1);

    if (existing.length === 0) {
      return {
        success: false,
        error: "Documentation type not found",
      };
    }

    // Check if new name conflicts with existing types (if name is being updated)
    if (data.name && data.name.trim() !== existing[0].name) {
      const nameConflict = await db
        .select()
        .from(documentationType)
        .where(eq(documentationType.name, data.name.trim()))
        .limit(1);

      if (nameConflict.length > 0) {
        return {
          success: false,
          error: "A documentation type with this name already exists",
        };
      }
    }

    const updateData: Partial<typeof documentationType.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined)
      updateData.description = data.description.trim() || null;
    if (data.exampleUrl !== undefined)
      updateData.exampleUrl = data.exampleUrl.trim() || null;

    const updatedType = await db
      .update(documentationType)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(documentationType.id, id))
      .returning();

    revalidatePath("/dashboard/admin/documentation");

    return {
      success: true,
      result: updatedType[0],
      message: "Documentation type updated successfully",
    };
  } catch (error) {
    console.error("Error updating documentation type:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update documentation type",
    };
  }
}

/**
 * Delete a documentation type
 */
export async function deleteDocumentationType(
  id: string
): Promise<ActionResponse> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Documentation type ID is required",
      };
    }

    // Check if documentation type exists
    const existing = await db
      .select()
      .from(documentationType)
      .where(eq(documentationType.id, id))
      .limit(1);

    if (existing.length === 0) {
      return {
        success: false,
        error: "Documentation type not found",
      };
    }

    // Check if documentation type is being used by any category rules
    const categoryUsage = await db
      .select()
      .from(categoryRulesDocumentation)
      .where(eq(categoryRulesDocumentation.documentationTypeId, id))
      .limit(1);

    if (categoryUsage.length > 0) {
      return {
        success: false,
        error:
          "Cannot delete documentation type that is required by category rules. Remove it from category rules first.",
      };
    }

    // Check if documentation type has any seller documents
    const sellerUsage = await db
      .select()
      .from(sellerDocumentation)
      .where(eq(sellerDocumentation.documentationTypeId, id))
      .limit(1);

    if (sellerUsage.length > 0) {
      return {
        success: false,
        error:
          "Cannot delete documentation type that has seller documents. Delete seller documents first.",
      };
    }

    await db.delete(documentationType).where(eq(documentationType.id, id));

    revalidatePath("/dashboard/admin/documentation");

    return {
      success: true,
      message: "Documentation type deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting documentation type:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete documentation type",
    };
  }
}

// ===== CATEGORY RULES DOCUMENTATION LINKING =====

/**
 * Get documentation types required for a category rule
 */
export async function getCategoryRuleDocumentationTypes(
  categoryRuleId: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      documentationTypeId: string;
      documentationTypeName: string;
    }>;
  }
> {
  try {
    const categoryDocs = await db
      .select({
        id: categoryRulesDocumentation.id,
        documentationTypeId: categoryRulesDocumentation.documentationTypeId,
        documentationTypeName: documentationType.name,
      })
      .from(categoryRulesDocumentation)
      .innerJoin(
        documentationType,
        eq(categoryRulesDocumentation.documentationTypeId, documentationType.id)
      )
      .where(eq(categoryRulesDocumentation.categoryRuleId, categoryRuleId));

    return {
      success: true,
      result: categoryDocs,
    };
  } catch (error) {
    console.error("Error fetching category rule documentation types:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch category rule documentation types",
    };
  }
}

/**
 * Link documentation types to a category rule
 */
export async function linkDocumentationTypesToCategoryRule(
  categoryRuleId: string,
  documentationTypeIds: string[]
): Promise<ActionResponse> {
  try {
    if (!categoryRuleId) {
      return {
        success: false,
        error: "Category rule ID is required",
      };
    }

    // Remove existing links
    await db
      .delete(categoryRulesDocumentation)
      .where(eq(categoryRulesDocumentation.categoryRuleId, categoryRuleId));

    // Add new links if any
    if (documentationTypeIds.length > 0) {
      const links = documentationTypeIds.map((docTypeId) => ({
        categoryRuleId,
        documentationTypeId: docTypeId,
      }));

      await db.insert(categoryRulesDocumentation).values(links);
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings/documentation");

    return {
      success: true,
      message: "Documentation types linked to category rule successfully",
    };
  } catch (error) {
    console.error("Error linking documentation types to category rule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to link documentation types to category rule",
    };
  }
}

/**
 * @deprecated Use getCategoryRuleDocumentationTypes instead
 * Legacy function for backward compatibility
 */
export async function getCategoryDocumentationTypes(
  categoryRuleId: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      documentationTypeId: string;
      documentationTypeName: string;
    }>;
  }
> {
  return getCategoryRuleDocumentationTypes(categoryRuleId);
}

/**
 * @deprecated Use linkDocumentationTypesToCategoryRule instead
 * Legacy function for backward compatibility
 */
export async function linkDocumentationTypesToCategory(
  categoryRuleId: string,
  documentationTypeIds: string[]
): Promise<ActionResponse> {
  return linkDocumentationTypesToCategoryRule(
    categoryRuleId,
    documentationTypeIds
  );
}
