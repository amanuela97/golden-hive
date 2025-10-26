"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
} from "@/app/actions/categories";
import toast from "react-hot-toast";

// Query Keys
export const categoryQueryKeys = {
  categories: ["categories"] as const,
  category: (id: string) => ["categories", id] as const,
};

// Category Queries
export function useCategories() {
  return useQuery({
    queryKey: categoryQueryKeys.categories,
    queryFn: getAllCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCategory(categoryId: string) {
  return useQuery({
    queryKey: categoryQueryKeys.category(categoryId),
    queryFn: () => getCategoryById(categoryId),
    enabled: !!categoryId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.categories });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create category");
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      categoryData,
    }: {
      categoryId: string;
      categoryData: {
        name?: string;
        description?: string;
        requiresDocumentation?: boolean;
        documentationDescription?: string;
        documentationTypeIds?: string[];
      };
    }) => updateCategory(categoryId, categoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.categories });
      toast.success("Category updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update category");
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryQueryKeys.categories });
      toast.success("Category deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete category");
    },
  });
}
