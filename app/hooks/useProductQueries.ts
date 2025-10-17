"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPublicProducts,
  getPublicProductById,
  getRelatedProducts,
  getFeaturedProducts,
} from "@/app/actions/public-products";

// Query Keys
export const productQueryKeys = {
  products: ["products"] as const,
  product: (id: string) => ["products", id] as const,
  relatedProducts: (productId: string, categoryId: string | null) =>
    ["products", "related", productId, categoryId] as const,
  featuredProducts: (limit?: number) =>
    ["products", "featured", limit] as const,
};

// Product Queries
export function useProducts() {
  return useQuery({
    queryKey: productQueryKeys.products,
    queryFn: () => getPublicProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: productQueryKeys.product(productId),
    queryFn: () => getPublicProductById(productId),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useRelatedProducts(
  productId: string,
  categoryId: string | null,
  limit: number = 4
) {
  return useQuery({
    queryKey: productQueryKeys.relatedProducts(productId, categoryId),
    queryFn: () => getRelatedProducts(productId, categoryId, limit),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFeaturedProducts(limit: number = 8) {
  return useQuery({
    queryKey: productQueryKeys.featuredProducts(limit),
    queryFn: () => getFeaturedProducts(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
