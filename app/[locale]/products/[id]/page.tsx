"use client";

import { use, useState, useMemo, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Minus,
  Plus,
  MapPin,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowLeft,
} from "lucide-react";
import { ProductCard } from "../../components/product-card";
import {
  useProduct,
  useRelatedProducts,
  useProductVariants,
} from "../../hooks/useProductQueries";
import { PublicProduct } from "../../actions/public-products";
import { useCart } from "@/lib/cart-context";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Variant = {
  id: string;
  title: string;
  sku: string | null;
  price: string | null;
  currency: string | null;
  compareAtPrice: string | null;
  imageUrl: string | null;
  options: Record<string, string> | null;
  available: number | null;
};

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: productData, isLoading, error } = useProduct(id);
  const product = productData?.result;
  const { data: variantsData } = useProductVariants(id);
  const variants = useMemo(
    () => variantsData?.result || [],
    [variantsData?.result]
  );
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [variantError, setVariantError] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isImageTransitioning, setIsImageTransitioning] = useState(false);
  const t = useTranslations("products");
  const navT = useTranslations("nav");

  const { data: relatedProductsData } = useRelatedProducts(
    id,
    product?.category || null,
    4
  );
  const relatedProducts = relatedProductsData?.result || [];

  // Extract unique option keys from variants
  const optionKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((variant) => {
      if (variant.options) {
        Object.keys(variant.options).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [variants]);

  // Get all images (product + gallery + variant images)
  const allImages = useMemo(() => {
    const images: string[] = [];

    // Add main product image
    if (product?.imageUrl) {
      images.push(product.imageUrl);
    }

    // Add gallery images
    if (product?.gallery && product.gallery.length > 0) {
      product.gallery.forEach((img) => {
        if (img && !images.includes(img)) {
          images.push(img);
        }
      });
    }

    // Add variant images
    variants.forEach((variant) => {
      if (variant.imageUrl && !images.includes(variant.imageUrl)) {
        images.push(variant.imageUrl);
      }
    });

    return images;
  }, [product, variants]);

  // Update selected variant when options change
  useEffect(() => {
    if (variants.length === 0) {
      setSelectedVariant(null);
      return;
    }

    // If all required options are selected, find matching variant
    if (
      optionKeys.length > 0 &&
      optionKeys.every((key) => selectedOptions[key])
    ) {
      const matchingVariant = variants.find((variant) => {
        if (!variant.options) return false;
        return optionKeys.every(
          (key) => variant.options?.[key] === selectedOptions[key]
        );
      });

      if (matchingVariant) {
        setSelectedVariant(matchingVariant);
        setVariantError("");

        // Update main image to variant image if available
        if (matchingVariant.imageUrl) {
          const variantImageIndex = allImages.findIndex(
            (img) => img === matchingVariant.imageUrl
          );
          if (variantImageIndex !== -1) {
            setCurrentImageIndex(variantImageIndex);
          }
        }
      } else {
        setSelectedVariant(null);
        setVariantError("This combination is not available");
      }
    } else {
      setSelectedVariant(null);
      if (optionKeys.length > 0) {
        setVariantError("Please select all options");
      } else {
        setVariantError("");
      }
    }
  }, [selectedOptions, variants, optionKeys, allImages]);

  // Get current price and compare price
  const currentPrice = useMemo(() => {
    if (selectedVariant?.price) {
      return parseFloat(selectedVariant.price);
    }
    return product ? parseFloat(product.price) : 0;
  }, [selectedVariant, product]);

  const currentComparePrice = useMemo(() => {
    if (selectedVariant?.compareAtPrice) {
      return parseFloat(selectedVariant.compareAtPrice);
    }
    return null;
  }, [selectedVariant]);

  const currentCurrency = useMemo(() => {
    return selectedVariant?.currency || product?.currency || "NPR";
  }, [selectedVariant, product]);

  const savings = useMemo(() => {
    if (currentComparePrice && currentComparePrice > currentPrice) {
      return currentComparePrice - currentPrice;
    }
    return null;
  }, [currentComparePrice, currentPrice]);

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrement = () => {
    setQuantity(quantity + 1);
  };

  // Generate variant title from selected options
  const getVariantTitle = useCallback(() => {
    if (!selectedVariant) return null;

    // Use variant title if available
    if (selectedVariant.title) {
      return selectedVariant.title;
    }

    // Otherwise, build from options
    if (
      selectedVariant.options &&
      Object.keys(selectedVariant.options).length > 0
    ) {
      return Object.entries(selectedVariant.options)
        .map(([key, value]) => {
          const label =
            key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
          return `${label}: ${value}`;
        })
        .join(", ");
    }

    return null;
  }, [selectedVariant]);

  const handleAddToCart = () => {
    if (!product) return;

    // Check if variant selection is required
    if (variants.length > 0 && !selectedVariant) {
      setVariantError("Please select all options");
      return;
    }

    addItem(
      {
        id: selectedVariant
          ? `${product.id}-${selectedVariant.id}`
          : product.id,
        listingId: product.id,
        variantId: selectedVariant?.id || null,
        variantTitle: getVariantTitle(),
        name: product.name,
        price: currentPrice,
        image:
          selectedVariant?.imageUrl || product.imageUrl || "/placeholder.svg",
        category: product.categoryName,
        currency: currentCurrency,
        sku: selectedVariant?.sku || null,
      },
      quantity
    );
    toast.success(t("addToCartSuccess", { quantity, name: product.name }));
    setQuantity(1);
  };

  const handleOptionChange = (optionKey: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionKey]: value,
    }));
  };

  const handleThumbnailClick = (index: number) => {
    if (index !== currentImageIndex) {
      setIsImageTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex(index);
        setIsImageTransitioning(false);
      }, 150);
    }
  };

  const handlePreviousImage = () => {
    setIsImageTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex((prev) =>
        prev > 0 ? prev - 1 : allImages.length - 1
      );
      setIsImageTransitioning(false);
    }, 150);
  };

  const handleNextImage = () => {
    setIsImageTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex((prev) =>
        prev < allImages.length - 1 ? prev + 1 : 0
      );
      setIsImageTransitioning(false);
    }, 150);
  };

  const handleMainImageClick = () => {
    setIsImageModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsImageModalOpen(false);
  };

  // Handle keyboard navigation in modal
  useEffect(() => {
    if (isImageModalOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsImageModalOpen(false);
        } else if (e.key === "ArrowLeft") {
          setIsImageTransitioning(true);
          setTimeout(() => {
            setCurrentImageIndex((prev) =>
              prev > 0 ? prev - 1 : allImages.length - 1
            );
            setIsImageTransitioning(false);
          }, 150);
        } else if (e.key === "ArrowRight") {
          setIsImageTransitioning(true);
          setTimeout(() => {
            setCurrentImageIndex((prev) =>
              prev < allImages.length - 1 ? prev + 1 : 0
            );
            setIsImageTransitioning(false);
          }, 150);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isImageModalOpen, allImages.length]);

  // Get unique values for each option
  const getOptionValues = (optionKey: string): string[] => {
    const values = new Set<string>();
    variants.forEach((variant) => {
      if (variant.options?.[optionKey]) {
        values.add(variant.options[optionKey]);
      }
    });
    return Array.from(values).sort();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-12 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t("loadingProduct")}</p>
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
        {/* Back Arrow */}
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Products</span>
        </Link>

        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground">
            {t("home")}
          </Link>
          <span className="mx-2">/</span>
          <span>{product.categoryName || navT("products")}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Product Image Gallery - Left side */}
          <div className="order-1 lg:order-1">
            {allImages.length > 0 ? (
              <div className="flex gap-4">
                {/* Thumbnail Column (Left) */}
                {allImages.length > 1 && (
                  <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto">
                    {allImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => handleThumbnailClick(index)}
                        className={`relative w-16 h-16 rounded border-2 transition-all ${
                          currentImageIndex === index
                            ? "border-foreground"
                            : "border-transparent hover:border-muted-foreground"
                        }`}
                        aria-label={`View image ${index + 1}`}
                      >
                        <Image
                          src={image}
                          alt={`${product.name} - Image ${index + 1}`}
                          fill
                          className="object-cover rounded"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main Image Viewer (Center) */}
                <div
                  className="flex-1 relative aspect-square bg-white rounded-lg overflow-hidden group cursor-zoom-in transition-opacity duration-500"
                  style={{
                    opacity: isImageTransitioning ? 0.5 : 1,
                  }}
                  onClick={handleMainImageClick}
                >
                  <Image
                    src={allImages[currentImageIndex] || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    className="object-contain transition-opacity duration-500"
                    priority
                  />

                  {/* Navigation Arrows */}
                  {allImages.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white shadow-lg rounded-full h-14 w-14 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviousImage();
                        }}
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-7 w-7" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white shadow-lg rounded-full h-14 w-14 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextImage();
                        }}
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-7 w-7" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                <Image
                  src="/placeholder.svg"
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </div>

          {/* Product Info - Right side */}
          <div className="order-2 lg:order-2">
            <h1 className="text-4xl font-bold mb-4 text-foreground text-balance">
              {product.name}
            </h1>

            {/* Price and Savings */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="text-3xl font-semibold text-foreground">
                  {currentCurrency} {currentPrice.toFixed(2)}
                </p>
                {savings && currentComparePrice && (
                  <div className="flex flex-col">
                    <span className="bg-yellow-400 text-yellow-900 px-2 py-1 text-sm font-semibold rounded">
                      SAVE {currentCurrency} {savings.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Regular price {currentCurrency}{" "}
                      {currentComparePrice.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

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
                <p>{t("noDescription")}</p>
              )}
            </div>

            {/* Variant Options */}
            {optionKeys.length > 0 && (
              <div className="space-y-4 mb-6">
                {optionKeys.map((optionKey) => {
                  const optionValues = getOptionValues(optionKey);
                  const optionLabel =
                    optionKey.charAt(0).toUpperCase() +
                    optionKey.slice(1).replace(/_/g, " ");

                  return (
                    <div key={optionKey}>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {optionLabel}
                      </label>
                      <Select
                        value={selectedOptions[optionKey] || ""}
                        onValueChange={(value) =>
                          handleOptionChange(optionKey, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={`Select ${optionLabel}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {optionValues.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {variantError && (
                  <p className="text-sm text-red-500 mt-2">{variantError}</p>
                )}
              </div>
            )}

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
                disabled={variants.length > 0 && !selectedVariant}
              >
                {t("addToCart")}
              </Button>
            </div>

            {/* Categories and Tags */}
            <div className="space-y-2 mb-6">
              {product.categoryName && (
                <p className="text-sm">
                  <span className="font-medium text-foreground">
                    {t("categories")}:
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {product.categoryName}
                  </span>
                </p>
              )}
              {product.marketType && (
                <p className="text-sm">
                  <span className="font-medium text-foreground">
                    {t("marketType")}:
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
                    {product.marketType === "local"
                      ? t("local")
                      : t("international")}
                  </span>
                </p>
              )}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {t("tags")}:
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

            {/* Description */}
            {product.description && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4 text-foreground">
                  {t("productDescription")}
                </h3>
                <div className="text-muted-foreground leading-relaxed space-y-4">
                  {product.description
                    .split("\n\n")
                    .map((paragraph: string, index: number) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full Screen Image Modal */}
        {isImageModalOpen && allImages.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={handleCloseModal}
          >
            {/* Blurred Background */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal Content */}
            <div
              className="relative z-10 w-full h-full flex items-center justify-center p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-white/90 hover:bg-white shadow-lg rounded-full h-12 w-12 z-20"
                onClick={handleCloseModal}
                aria-label="Close image viewer"
              >
                <X className="h-6 w-6" />
              </Button>

              {/* Main Image */}
              <div className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center">
                <Image
                  src={allImages[currentImageIndex] || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              {/* Navigation Arrows */}
              {allImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-8 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full h-16 w-16 z-20 cursor-pointer"
                    onClick={handlePreviousImage}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-8 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full h-16 w-16 z-20 cursor-pointer"
                    onClick={handleNextImage}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}

              {/* Image Counter */}
              {allImages.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full shadow-lg text-sm font-medium z-20">
                  {currentImageIndex + 1} / {allImages.length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-3xl font-bold mb-8 text-foreground">
              {t("relatedProducts")}
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
