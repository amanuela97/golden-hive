"use server";

import { db } from "@/db";
import {
  categoryRules,
  categoryRulesDocumentation,
  documentationType,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";
import { revalidatePath } from "next/cache";
import { findCategoryById } from "@/lib/taxonomy";

export interface CategoryRule {
  id: string;
  taxonomyCategoryId: string;
  requiresDocumentation: boolean;
  documentationDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  taxonomyCategoryName?: string; // Added for display
}

export interface CreateCategoryRuleData {
  taxonomyCategoryId: string;
  requiresDocumentation?: boolean;
  documentationDescription?: string;
  documentationTypeIds?: string[];
}

export interface UpdateCategoryRuleData {
  requiresDocumentation?: boolean;
  documentationDescription?: string;
  documentationTypeIds?: string[];
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

// Get all category rules
export async function getAllCategoryRules(): Promise<
  ActionResponse & { result?: CategoryRule[] }
> {
  try {
    const rules = await db
      .select()
      .from(categoryRules)
      .orderBy(desc(categoryRules.createdAt));

    // Enrich with taxonomy category names
    const enrichedRules = rules.map((rule) => {
      const taxonomyCategory = findCategoryById(rule.taxonomyCategoryId);
      return {
        ...rule,
        taxonomyCategoryName:
          taxonomyCategory?.full_name || rule.taxonomyCategoryId,
      };
    });

    return {
      success: true,
      result: enrichedRules,
    };
  } catch (error) {
    console.error("Error fetching category rules:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch category rules",
    };
  }
}

// Get category rule by ID
export async function getCategoryRuleById(
  ruleId: string
): Promise<ActionResponse & { result?: CategoryRule }> {
  try {
    await getCurrentAdmin();

    const rules = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, ruleId))
      .limit(1);

    if (rules.length === 0) {
      return {
        success: false,
        error: "Category rule not found",
      };
    }

    const rule = rules[0];
    const taxonomyCategory = findCategoryById(rule.taxonomyCategoryId);

    return {
      success: true,
      result: {
        ...rule,
        taxonomyCategoryName:
          taxonomyCategory?.full_name || rule.taxonomyCategoryId,
      },
    };
  } catch (error) {
    console.error("Error fetching category rule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch category rule",
    };
  }
}

// Get category rule by taxonomy category ID (for product creation)
export async function getCategoryRuleByTaxonomyId(
  taxonomyCategoryId: string
): Promise<ActionResponse & { result?: { id: string } }> {
  try {
    const rules = await db
      .select({ id: categoryRules.id })
      .from(categoryRules)
      .where(eq(categoryRules.taxonomyCategoryId, taxonomyCategoryId))
      .limit(1);

    if (rules.length === 0) {
      return {
        success: false,
        error: `No category rule found for taxonomy category: ${taxonomyCategoryId}. Please create a category rule first.`,
      };
    }

    return {
      success: true,
      result: { id: rules[0].id },
    };
  } catch (error) {
    console.error("Error fetching category rule by taxonomy ID:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch category rule",
    };
  }
}

// Get category rule with documentation types
export async function getCategoryRuleWithDocumentation(ruleId: string): Promise<
  ActionResponse & {
    result?: CategoryRule & {
      documentationTypes: Array<{
        id: string;
        documentationTypeId: string;
        documentationTypeName: string;
      }>;
    };
  }
> {
  try {
    await getCurrentAdmin();

    const rules = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, ruleId))
      .limit(1);

    if (rules.length === 0) {
      return {
        success: false,
        error: "Category rule not found",
      };
    }

    // Get documentation types for this rule
    const ruleDocs = await db
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
      .where(eq(categoryRulesDocumentation.categoryRuleId, ruleId));

    const rule = rules[0];
    const taxonomyCategory = findCategoryById(rule.taxonomyCategoryId);

    return {
      success: true,
      result: {
        ...rule,
        taxonomyCategoryName:
          taxonomyCategory?.full_name || rule.taxonomyCategoryId,
        documentationTypes: ruleDocs,
      },
    };
  } catch (error) {
    console.error("Error fetching category rule with documentation:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch category rule",
    };
  }
}

// Create a new category rule
export async function createCategoryRule(
  ruleData: CreateCategoryRuleData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if rule for this taxonomy category already exists
    const existingRule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.taxonomyCategoryId, ruleData.taxonomyCategoryId))
      .limit(1);

    if (existingRule.length > 0) {
      return {
        success: false,
        error: "A rule for this taxonomy category already exists",
      };
    }

    const newRule = await db
      .insert(categoryRules)
      .values({
        taxonomyCategoryId: ruleData.taxonomyCategoryId,
        requiresDocumentation: ruleData.requiresDocumentation || false,
        documentationDescription: ruleData.documentationDescription || null,
      })
      .returning();

    // Link documentation types if provided
    if (
      ruleData.documentationTypeIds &&
      ruleData.documentationTypeIds.length > 0
    ) {
      const links = ruleData.documentationTypeIds.map((docTypeId) => ({
        categoryRuleId: newRule[0].id,
        documentationTypeId: docTypeId,
      }));

      await db.insert(categoryRulesDocumentation).values(links);
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings/categories");

    return {
      success: true,
      message: "Category rule created successfully",
      result: newRule[0],
    };
  } catch (error) {
    console.error("Error creating category rule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create category rule",
    };
  }
}

// Update a category rule
export async function updateCategoryRule(
  ruleId: string,
  ruleData: UpdateCategoryRuleData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if rule exists
    const existingRule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, ruleId))
      .limit(1);

    if (existingRule.length === 0) {
      return {
        success: false,
        error: "Category rule not found",
      };
    }

    const updatedRule = await db
      .update(categoryRules)
      .set({
        requiresDocumentation: ruleData.requiresDocumentation,
        documentationDescription: ruleData.documentationDescription,
        updatedAt: new Date(),
      })
      .where(eq(categoryRules.id, ruleId))
      .returning();

    // Update documentation type links if provided
    if (ruleData.documentationTypeIds !== undefined) {
      // Remove existing links
      await db
        .delete(categoryRulesDocumentation)
        .where(eq(categoryRulesDocumentation.categoryRuleId, ruleId));

      // Add new links if any
      if (ruleData.documentationTypeIds.length > 0) {
        const links = ruleData.documentationTypeIds.map((docTypeId) => ({
          categoryRuleId: ruleId,
          documentationTypeId: docTypeId,
        }));

        await db.insert(categoryRulesDocumentation).values(links);
      }
    }

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings/categories");

    return {
      success: true,
      message: "Category rule updated successfully",
      result: updatedRule[0],
    };
  } catch (error) {
    console.error("Error updating category rule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update category rule",
    };
  }
}

// Delete a category rule
export async function deleteCategoryRule(
  ruleId: string
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if rule exists
    const existingRule = await db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.id, ruleId))
      .limit(1);

    if (existingRule.length === 0) {
      return {
        success: false,
        error: "Category rule not found",
      };
    }

    await db.delete(categoryRules).where(eq(categoryRules.id, ruleId));

    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings/categories");

    return {
      success: true,
      message: "Category rule deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting category rule:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete category rule",
    };
  }
}
