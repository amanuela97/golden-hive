"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllFaqSections,
  getFaqSectionWithItems,
  createFaqSection,
  updateFaqSection,
  deleteFaqSection,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  type FaqSectionData,
  type FaqSectionWithItems,
  type FaqItemData,
  type CreateFaqSectionInput,
  type UpdateFaqSectionInput,
  type CreateFaqItemInput,
  type UpdateFaqItemInput,
} from "../actions/faq";
import toast from "react-hot-toast";

// Query keys
export const FAQ_QUERY_KEYS = {
  all: ["faq"] as const,
  sections: () => [...FAQ_QUERY_KEYS.all, "sections"] as const,
  section: (id: number) => [...FAQ_QUERY_KEYS.sections(), id] as const,
};

// Get all FAQ sections
export function useFaqSections() {
  return useQuery({
    queryKey: FAQ_QUERY_KEYS.sections(),
    queryFn: async () => {
      const result = await getAllFaqSections();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch FAQ sections");
      }
      return result.result || [];
    },
  });
}

// Get FAQ section with items
export function useFaqSection(sectionId: number) {
  return useQuery({
    queryKey: FAQ_QUERY_KEYS.section(sectionId),
    queryFn: async () => {
      const result = await getFaqSectionWithItems(sectionId);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch FAQ section");
      }
      return result.result;
    },
    enabled: !!sectionId,
  });
}

// Create FAQ section mutation
export function useCreateFaqSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFaqSectionInput) => {
      const result = await createFaqSection(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to create FAQ section");
      }
      return result.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAQ_QUERY_KEYS.sections() });
      toast.success("FAQ section created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create FAQ section");
    },
  });
}

// Update FAQ section mutation
export function useUpdateFaqSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateFaqSectionInput) => {
      const result = await updateFaqSection(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to update FAQ section");
      }
      return result.result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: FAQ_QUERY_KEYS.sections() });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: FAQ_QUERY_KEYS.section(data.id),
        });
      }
      toast.success("FAQ section updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update FAQ section");
    },
  });
}

// Delete FAQ section mutation
export function useDeleteFaqSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: number) => {
      const result = await deleteFaqSection(sectionId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete FAQ section");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAQ_QUERY_KEYS.sections() });
      toast.success("FAQ section deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete FAQ section");
    },
  });
}

// Create FAQ item mutation
export function useCreateFaqItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFaqItemInput) => {
      const result = await createFaqItem(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to create FAQ item");
      }
      return result.result;
    },
    onSuccess: (data) => {
      if (data?.sectionId) {
        queryClient.invalidateQueries({
          queryKey: FAQ_QUERY_KEYS.section(data.sectionId),
        });
        queryClient.invalidateQueries({
          queryKey: FAQ_QUERY_KEYS.sections(),
        });
      }
      toast.success("FAQ item created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create FAQ item");
    },
  });
}

// Update FAQ item mutation
export function useUpdateFaqItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateFaqItemInput) => {
      const result = await updateFaqItem(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to update FAQ item");
      }
      return result.result;
    },
    onSuccess: (data) => {
      if (data?.sectionId) {
        queryClient.invalidateQueries({
          queryKey: FAQ_QUERY_KEYS.section(data.sectionId),
        });
        queryClient.invalidateQueries({
          queryKey: FAQ_QUERY_KEYS.sections(),
        });
      }
      toast.success("FAQ item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update FAQ item");
    },
  });
}

// Delete FAQ item mutation
export function useDeleteFaqItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      sectionId,
    }: {
      itemId: number;
      sectionId: number;
    }) => {
      const result = await deleteFaqItem(itemId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete FAQ item");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: FAQ_QUERY_KEYS.section(variables.sectionId),
      });
      queryClient.invalidateQueries({
        queryKey: FAQ_QUERY_KEYS.sections(),
      });
      toast.success("FAQ item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete FAQ item");
    },
  });
}
