"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  getAllHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  getAboutSection,
  createAboutSection,
  updateAboutSection,
  getBenefitsSection,
  createBenefitsSection,
  updateBenefitsSection,
} from "@/app/actions/homepage-content";

// Query Keys
export const homepageContentQueryKeys = {
  heroSlides: ["homepage-content", "hero-slides"] as const,
  aboutSection: ["homepage-content", "about"] as const,
  benefitsSection: ["homepage-content", "benefits"] as const,
  galleryImages: ["homepage-content", "gallery"] as const,
};

// Hero Slides Queries
export function useHeroSlides() {
  return useQuery({
    queryKey: homepageContentQueryKeys.heroSlides,
    queryFn: () => getAllHeroSlides(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateHeroSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createHeroSlide,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.heroSlides,
      });
      toast.success("Hero slide created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create hero slide");
    },
  });
}

export function useUpdateHeroSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateHeroSlide,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.heroSlides,
      });
      toast.success("Hero slide updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update hero slide");
    },
  });
}

export function useDeleteHeroSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteHeroSlide,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.heroSlides,
      });
      toast.success("Hero slide deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete hero slide");
    },
  });
}

// About Section Queries
export function useAboutSection() {
  return useQuery({
    queryKey: homepageContentQueryKeys.aboutSection,
    queryFn: () => getAboutSection(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateAboutSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAboutSection,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.aboutSection,
      });
      toast.success("About section created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create about section");
    },
  });
}

export function useUpdateAboutSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAboutSection,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.aboutSection,
      });
      toast.success("About section updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update about section");
    },
  });
}

// Benefits Section Queries
export function useBenefitsSection() {
  return useQuery({
    queryKey: homepageContentQueryKeys.benefitsSection,
    queryFn: () => getBenefitsSection(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateBenefitsSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBenefitsSection,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.benefitsSection,
      });
      toast.success("Benefits section created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create benefits section");
    },
  });
}

export function useUpdateBenefitsSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBenefitsSection,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: homepageContentQueryKeys.benefitsSection,
      });
      toast.success("Benefits section updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update benefits section");
    },
  });
}
