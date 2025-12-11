"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  getCategoryRuleById,
  getCategoryRuleWithDocumentation,
  type CreateCategoryRuleData,
  type UpdateCategoryRuleData,
} from "../actions/category-rules";
import toast from "react-hot-toast";

// Query Keys
export const categoryRuleQueryKeys = {
  categoryRules: ["categoryRules"] as const,
  categoryRule: (id: string) => ["categoryRules", id] as const,
};

// Category Rule Queries
export function useCategoryRules() {
  return useQuery({
    queryKey: categoryRuleQueryKeys.categoryRules,
    queryFn: getAllCategoryRules,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCategoryRule(ruleId: string) {
  return useQuery({
    queryKey: categoryRuleQueryKeys.categoryRule(ruleId),
    queryFn: () => getCategoryRuleById(ruleId),
    enabled: !!ruleId,
  });
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRuleData) => createCategoryRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryRuleQueryKeys.categoryRules });
      toast.success("Category rule created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create category rule");
    },
  });
}

export function useUpdateCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ruleId,
      ruleData,
    }: {
      ruleId: string;
      ruleData: UpdateCategoryRuleData;
    }) => updateCategoryRule(ruleId, ruleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryRuleQueryKeys.categoryRules });
      toast.success("Category rule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update category rule");
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategoryRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryRuleQueryKeys.categoryRules });
      toast.success("Category rule deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete category rule");
    },
  });
}

