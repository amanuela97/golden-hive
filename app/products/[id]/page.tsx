"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Minus, Plus, MapPin, Globe } from "lucide-react";
import { ProductCard } from "@/app/components/product-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduct, useRelatedProducts } from "@/app/hooks/useProductQueries";
import { PublicProduct } from "@/app/actions/public-products";
import { useCart } from "@/lib/cart-context";
import toast from "react-hot-toast";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: productData, isLoading, error } = useProduct(id);
  const product = productData?.result;
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const { data: relatedProductsData } = useRelatedProducts(
    id,
    product?.category || null,
    4
  );
  const relatedProducts = relatedProductsData?.result || [];

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrement = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    if (!product) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.imageUrl,
        category: product.categoryName,
        currency: product.currency || "NPR",
      },
      quantity
    );
    toast.success(`${quantity} ${product.name} added to cart!`);
    setQuantity(1); // Reset quantity after adding
  };

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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value) || 1;
                    setQuantity(Math.max(1, value));
                  }}
                  min="1"
                  className="w-16 text-center border-x border-border bg-transparent text-foreground"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={handleIncrement}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1 h-12 text-base"
                onClick={handleAddToCart}
              >
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
              {product.marketType && (
                <p className="text-sm">
                  <span className="font-medium text-foreground">
                    Market Type:
                  </span>{" "}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      product.marketType === "local"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {product.marketType === "local" ? (
                      <MapPin className="w-3 h-3" />
                    ) : (
                      <Globe className="w-3 h-3" />
                    )}
                    {product.marketType === "local" ? "Local" : "International"}
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
                  <p>{product.description}</p>
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
