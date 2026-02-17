"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  Heart,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCustomerLocation } from "../../hooks/useCustomerLocation";
import { checkShippingAvailability } from "../../actions/shipping-availability";
import { ProductCard } from "../../components/product-card";
import {
  PublicProduct,
  validateInventoryForCartItem,
} from "../../actions/public-products";
import { useCart } from "@/lib/cart-context";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductReviews } from "./ProductReviews";
import { useSession } from "@/lib/auth-client";
import {
  toggleListingFavorite,
  isListingFavorite,
} from "../../actions/favorites";
import {
  addGuestFavorite,
  removeGuestFavorite,
  isGuestFavorite,
} from "@/lib/guest-favorites";

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

interface ProductDetailClientProps {
  initialProduct: PublicProduct;
  initialVariants: Variant[];
  initialRelatedProducts: PublicProduct[];
}

export function ProductDetailClient({
  initialProduct: product,
  initialVariants: variants,
  initialRelatedProducts: relatedProducts,
}: ProductDetailClientProps) {
  const { addItem } = useCart();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const { country } = useCustomerLocation();
  const [shippingAvailable, setShippingAvailable] = useState<boolean | null>(
    product.shippingAvailable ?? null
  );
  const [checkingShipping, setCheckingShipping] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [variantError, setVariantError] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isImageTransitioning, setIsImageTransitioning] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(true);
  const t = useTranslations("products");
  const navT = useTranslations("nav");

  // Check shipping availability when country is detected
  useEffect(() => {
    if (country && product?.id) {
      setCheckingShipping(true);
      checkShippingAvailability(product.id, country)
        .then((result) => {
          setShippingAvailable(result.available);
        })
        .catch((error) => {
          console.error("Error checking shipping availability:", error);
        })
        .finally(() => {
          setCheckingShipping(false);
        });
    }
  }, [country, product?.id]);

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
      // Single variant with no options: default to it so we have stock info
      if (variants.length === 1 && optionKeys.length === 0) {
        setSelectedVariant(variants[0]);
        setVariantError("");
      } else {
        setSelectedVariant(null);
        if (optionKeys.length > 0) {
          setVariantError("Please select an option");
        } else {
          setVariantError("");
        }
      }
    }
  }, [selectedOptions, variants, optionKeys, allImages]);

  // Available quantity for current selection (for stock checks and cap)
  const availableForSelection =
    selectedVariant?.available != null ? selectedVariant.available : null;
  const isOutOfStock =
    availableForSelection !== null && availableForSelection <= 0;

  // Cap quantity to available when selection or available changes
  useEffect(() => {
    if (availableForSelection != null && quantity > availableForSelection) {
      setQuantity(Math.max(1, availableForSelection));
    }
  }, [availableForSelection, quantity]);

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
    // Also check product compareAtPrice if no variant compare price
    if (!currentComparePrice && product?.compareAtPrice) {
      const productComparePrice = parseFloat(product.compareAtPrice);
      if (productComparePrice > currentPrice) {
        return productComparePrice - currentPrice;
      }
    }
    return null;
  }, [currentComparePrice, currentPrice, product]);

  // Check favorite status
  useEffect(() => {
    if (!product?.id) return;
    
    const checkFavoriteStatus = async () => {
      if (isAuthenticated) {
        const favorite = await isListingFavorite(product.id);
        setIsFavorite(favorite);
      } else {
        const guestFavorite = isGuestFavorite("product", product.id);
        setIsFavorite(guestFavorite);
      }
      setIsLoadingFavorite(false);
    };
    checkFavoriteStatus();
  }, [product?.id, isAuthenticated]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product?.id) return;

    setIsToggling(true);
    try {
      if (isAuthenticated) {
        const result = await toggleListingFavorite(product.id);
        if (result.success) {
          setIsFavorite(result.isFavorite);
          toast.success(
            result.isFavorite ? "Added to favorites" : "Removed from favorites"
          );
        } else {
          toast.error(result.error || "Failed to update favorite status");
        }
      } else {
        const currentlyFavorite = isGuestFavorite("product", product.id);
        if (currentlyFavorite) {
          removeGuestFavorite("product", product.id);
          setIsFavorite(false);
          toast.success("Removed from favorites");
        } else {
          addGuestFavorite("product", product.id);
          setIsFavorite(true);
          toast.success("Added to favorites");
        }
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite status");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrement = () => {
    const maxQty =
      availableForSelection != null ? availableForSelection : undefined;
    setQuantity((q) => (maxQty != null ? Math.min(q + 1, maxQty) : q + 1));
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

  const handleAddToCart = async () => {
    if (!product) return;

    // Check if variant selection is required
    if (variants.length > 0 && !selectedVariant) {
      setVariantError("Please select an option");
      return;
    }

    // Enforce stock (client-side from cached data)
    if (availableForSelection != null) {
      if (availableForSelection <= 0) {
        toast.error(t("outOfStock") || "This item is out of stock.");
        return;
      }
      if (quantity > availableForSelection) {
        toast.error(
          t("insufficientStock") ||
            `Only ${availableForSelection} available. Please reduce quantity.`
        );
        setQuantity(availableForSelection);
        return;
      }
    }

    // Server-side validation: avoid adding more than current stock (guards against stale cache)
    const validation = await validateInventoryForCartItem(
      product.id,
      selectedVariant?.id ?? null,
      quantity
    );
    if (!validation.success) {
      toast.error(validation.error || "Could not verify stock.");
      return;
    }
    if (!validation.allowed) {
      const avail = validation.available ?? 0;
      if (avail <= 0) {
        toast.error(t("outOfStock") || "This item is out of stock.");
      } else {
        toast.error(
          t("insufficientStock") || `Only ${avail} available. Please reduce quantity.`
        );
        setQuantity(avail);
      }
      return;
    }

    addItem(
      {
        id: selectedVariant
          ? `${product.id}-${selectedVariant.id}`
          : product.id,
        listingId: product.id,
        listingSlug: product.slug || null,
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
                          quality={85}
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
                    sizes="(max-width: 768px) 100vw, 50vw"
                    quality={90}
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
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            )}
          </div>

          {/* Product Info - Right side */}
          <div className="order-2 lg:order-2">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-foreground text-balance">
                {product.name}
              </h1>
              <button
                onClick={handleFavoriteClick}
                disabled={isToggling || isLoadingFavorite}
                className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart
                  className={`w-6 h-6 transition-all duration-200 ${
                    isFavorite
                      ? "fill-primary text-primary"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {product.marketType && (
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
              )}
              {shippingAvailable === false && (
                <Badge
                  variant="outline"
                  className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Shipping may not be available
                </Badge>
              )}
            </div>
            {product.storeName && product.storeSlug && (
              <Link
                href={`/store/${product.storeSlug}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors mb-4 block"
              >
                {product.storeName}
              </Link>
            )}

            {/* Price and Savings */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 flex-wrap">
                {savings && (currentComparePrice || product?.compareAtPrice) ? (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="text-3xl font-semibold text-foreground">
                      {currentCurrency} {currentPrice.toFixed(2)}
                    </p>
                    <p className="text-xl font-semibold text-muted-foreground line-through">
                      {currentCurrency}{" "}
                      {(currentComparePrice || parseFloat(product?.compareAtPrice || "0")).toFixed(2)}
                    </p>
                    <div className="flex flex-col">
                      <span className="bg-accent text-accent-foreground px-2 py-0.5 text-xs font-semibold rounded">
                        SAVE {currentCurrency} {savings.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-3xl font-semibold text-foreground">
                    {currentCurrency} {currentPrice.toFixed(2)}
                  </p>
                )}
              </div>
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
                    const maxQty =
                      availableForSelection != null
                        ? availableForSelection
                        : undefined;
                    const clamped =
                      maxQty != null
                        ? Math.max(1, Math.min(value, maxQty))
                        : Math.max(1, value);
                    setQuantity(clamped);
                  }}
                  min={1}
                  max={
                    availableForSelection != null && availableForSelection > 0
                      ? availableForSelection
                      : undefined
                  }
                  className="w-16 text-center border-x border-border bg-transparent text-foreground"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={handleIncrement}
                  disabled={
                    availableForSelection != null &&
                    quantity >= availableForSelection
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1 h-12 text-base"
                onClick={handleAddToCart}
                disabled={
                  (variants.length > 0 && !selectedVariant) || isOutOfStock
                }
              >
                {isOutOfStock
                  ? t("outOfStock") || "Out of stock"
                  : t("addToCart")}
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
                  sizes="100vw"
                  quality={90}
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

        {/* Reviews */}
        <ProductReviews
          listingId={product.id}
          ratingAverage={product.ratingAverage}
          ratingCount={product.ratingCount}
        />

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

