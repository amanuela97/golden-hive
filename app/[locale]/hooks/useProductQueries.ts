"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  getPublicProducts,
  getPublicProductById,
  getRelatedProducts,
  getFeaturedProducts,
  getPublicProductVariants,
} from "../actions/public-products";

// Query Keys
export const productQueryKeys = {
  products: (locale: string) => ["products", locale] as const,
  product: (id: string, locale: string) => ["products", id, locale] as const,
  relatedProducts: (
    productId: string,
    categoryId: string | null,
    locale: string
  ) => ["products", "related", productId, categoryId, locale] as const,
  featuredProducts: (limit: number | undefined, locale: string) =>
    ["products", "featured", limit, locale] as const,
  productVariants: (listingId: string) => ["products", "variants", listingId] as const,
};

// Product Queries
export function useProducts() {
  const locale = useLocale();
  return useQuery({
    queryKey: productQueryKeys.products(locale),
    queryFn: () => getPublicProducts(locale),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProduct(productId: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: productQueryKeys.product(productId, locale),
    queryFn: () => getPublicProductById(productId, locale),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useRelatedProducts(
  productId: string,
  categoryId: string | null,
  limit: number = 4
) {
  const locale = useLocale();
  return useQuery({
    queryKey: productQueryKeys.relatedProducts(productId, categoryId, locale),
    queryFn: () => getRelatedProducts(productId, categoryId, locale, limit),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFeaturedProducts(limit: number = 8) {
  const locale = useLocale();
  return useQuery({
    queryKey: productQueryKeys.featuredProducts(limit, locale),
    queryFn: () => getFeaturedProducts(locale, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useProductVariants(listingId: string) {
  return useQuery({
    queryKey: productQueryKeys.productVariants(listingId),
    queryFn: () => getPublicProductVariants(listingId),
    enabled: !!listingId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
