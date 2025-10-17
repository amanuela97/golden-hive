"use server";

import { db } from "@/db";
import { category } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

// Get all categories
export async function getAllCategories(): Promise<
  ActionResponse & { result?: Category[] }
> {
  try {
    const categories = await db
      .select()
      .from(category)
      .orderBy(desc(category.createdAt));

    return {
      success: true,
      result: categories,
    };
  } catch (error) {
    console.error("Error fetching categories:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch categories",
    };
  }
}

// Get category by ID
export async function getCategoryById(
  categoryId: string
): Promise<ActionResponse & { result?: Category }> {
  try {
    await getCurrentAdmin();

    const categories = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);

    if (categories.length === 0) {
      return {
        success: false,
        error: "Category not found",
      };
    }

    return {
      success: true,
      result: categories[0],
    };
  } catch (error) {
    console.error("Error fetching category:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch category",
    };
  }
}

// Create a new category
export async function createCategory(
  categoryData: CreateCategoryData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if category name already exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.name, categoryData.name))
      .limit(1);

    if (existingCategory.length > 0) {
      return {
        success: false,
        error: "Category with this name already exists",
      };
    }

    const newCategory = await db
      .insert(category)
      .values({
        name: categoryData.name,
        description: categoryData.description || null,
      })
      .returning();

    return {
      success: true,
      message: "Category created successfully",
      result: newCategory[0],
    };
  } catch (error) {
    console.error("Error creating category:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

// Update a category
export async function updateCategory(
  categoryId: string,
  categoryData: UpdateCategoryData
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if category exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);

    if (existingCategory.length === 0) {
      return {
        success: false,
        error: "Category not found",
      };
    }

    // If name is being updated, check for duplicates
    if (categoryData.name && categoryData.name !== existingCategory[0].name) {
      const duplicateCategory = await db
        .select()
        .from(category)
        .where(eq(category.name, categoryData.name))
        .limit(1);

      if (duplicateCategory.length > 0) {
        return {
          success: false,
          error: "Category with this name already exists",
        };
      }
    }

    const updatedCategory = await db
      .update(category)
      .set({
        name: categoryData.name,
        description: categoryData.description,
        updatedAt: new Date(),
      })
      .where(eq(category.id, categoryId))
      .returning();

    return {
      success: true,
      message: "Category updated successfully",
      result: updatedCategory[0],
    };
  } catch (error) {
    console.error("Error updating category:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update category",
    };
  }
}

// Delete a category
export async function deleteCategory(
  categoryId: string
): Promise<ActionResponse> {
  try {
    await getCurrentAdmin();

    // Check if category exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);

    if (existingCategory.length === 0) {
      return {
        success: false,
        error: "Category not found",
      };
    }

    await db.delete(category).where(eq(category.id, categoryId));

    return {
      success: true,
      message: "Category deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting category:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete category",
    };
  }
}
