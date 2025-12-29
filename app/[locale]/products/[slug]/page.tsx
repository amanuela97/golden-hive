import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicProductBySlug, getPublicProductVariants, getRelatedProducts } from "../../actions/public-products";
import { getLocale } from "next-intl/server";
import { ProductDetailClient } from "./ProductDetailClient";

export const revalidate = 3600; // ISR: revalidate every hour

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  
  // Fetch product server-side
  const productResult = await getPublicProductBySlug(slug, locale);
  
  if (!productResult.success || !productResult.result) {
    notFound();
  }
  
  const product = productResult.result;
  
  // Fetch variants and related products in parallel
  const [variantsResult, relatedProductsResult] = await Promise.all([
    getPublicProductVariants(product.id),
    getRelatedProducts(product.id, product.category, locale, 4),
  ]);
  
  const variants = variantsResult?.success ? variantsResult.result || [] : [];
  const relatedProducts = relatedProductsResult?.success ? relatedProductsResult.result || [] : [];
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-12 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading product...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ProductDetailClient 
        initialProduct={product}
        initialVariants={variants}
        initialRelatedProducts={relatedProducts}
      />
    </Suspense>
  );
}
