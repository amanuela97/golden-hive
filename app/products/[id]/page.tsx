"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { ProductCard } from "@/app/components/product-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduct, useRelatedProducts } from "@/app/hooks/useProductQueries";
import { PublicProduct } from "@/app/actions/public-products";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: productData, isLoading, error } = useProduct(id);
  const product = productData?.result;

  const { data: relatedProductsData } = useRelatedProducts(
    id,
    product?.category || null,
    4
  );
  const relatedProducts = relatedProductsData?.result || [];

  if (isLoading) {
    return (
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
    );
  }

  if (error || !product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-12 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-8">
          <span>Home</span>
          <span className="mx-2">/</span>
          <span>{product.categoryName || "Products"}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Product Info - Left side */}
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl font-bold mb-4 text-foreground text-balance">
              {product.name}
            </h1>
            <p className="text-3xl font-semibold mb-6 text-foreground">
              {product.currency} {parseFloat(product.price).toFixed(2)}
            </p>

            <div className="prose prose-sm max-w-none mb-8 text-muted-foreground leading-relaxed">
              {product.description ? (
                product.description
                  .split("\n\n")
                  .map((paragraph: string, index: number) => (
                    <p key={index} className="mb-4">
                      {paragraph}
                    </p>
                  ))
              ) : (
                <p>No description available.</p>
              )}
            </div>

            {/* Quantity and Add to Cart */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border border-border rounded-lg">
                <Button variant="ghost" size="icon" className="h-12 w-12">
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  value="1"
                  readOnly
                  className="w-16 text-center border-x border-border bg-transparent text-foreground"
                />
                <Button variant="ghost" size="icon" className="h-12 w-12">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button size="lg" className="flex-1 h-12 text-base">
                Add to Cart
              </Button>
            </div>

            {/* Categories and Tags */}
            <div className="space-y-2 mb-6">
              {product.categoryName && (
                <p className="text-sm">
                  <span className="font-medium text-foreground">Category:</span>{" "}
                  <span className="text-muted-foreground">
                    {product.categoryName}
                  </span>
                </p>
              )}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium text-foreground text-sm">
                    Tags:
                  </span>
                  {product.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Image - Right side */}
          <div className="order-1 lg:order-2">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
              <Image
                src={product.imageUrl || "/placeholder.svg"}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>

        {/* Description Tab */}
        <div className="mb-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger
                value="description"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                Description
              </TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-8">
              <div className="prose prose-sm max-w-none">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  Product Description
                </h3>
                <div className="text-muted-foreground leading-relaxed space-y-4">
                  <p>
                    Mad honey, collected in the spring from the elevated regions
                    of Nepal, provides a distinctive experience with its sweet
                    yet intense fragrance, reminiscent of a lovely bouquet of
                    rhododendron flowers. Its remarkable taste is characterized
                    by a floral sweetness, a delicate herbal sensation and a
                    mild burn on the tongue. The traditional hand-squeezing
                    technique produces a golden red honey, while its elevated
                    moisture content leads to light fermentation. This honey
                    undergoes minimal processing, remaining raw and
                    unpasteurized, with only external particles being filtered
                    out. The honey is derived from the nectar of white
                    rhododendron species, this exceptional honey represents the
                    pure essence of nature&apos;s offerings.
                  </p>
                  <h4 className="text-lg font-semibold mt-6 mb-3 text-foreground">
                    Potential Benefits
                  </h4>
                  <p>
                    Clinical Mad Honey is not only effective for various issues
                    like anxiety, hypertension, diabetes, and depression, but it
                    also offers additional well-known for its stimulating
                    effects. Just a small amount can create a sense of euphoria
                    that enhances feelings of happiness and relaxation. For
                    centuries, villagers in the remote mountains of Nepal have
                    consumed mad honey typically for its health benefits and for
                    a delightful boost that sustains them throughout the day.
                  </p>
                  <h4 className="text-lg font-semibold mt-6 mb-3 text-foreground">
                    Usage
                  </h4>
                  <p>
                    The recommended serving size for mad honey is 1-8 grams,
                    providing 10 servings per container. This size container is
                    intended more for trial use rather than regular consumption,
                    as it lasts only 10 days with daily use. We recommend to
                    start 1 teaspoon before you eat. Taking it on a cool, dry
                    location and consume it within 12 months after opening.
                    Taking it for 2 hours before bedtime potentially improves
                    your sleep quality and consider that this product is not
                    advisable for those on prescription medications. The product
                    is also not advisable for pregnant and nursing women.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold mb-8 text-foreground">
              Related products
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {relatedProducts.map((relatedProduct: PublicProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
