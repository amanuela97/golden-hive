"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { PublicProduct } from "../actions/public-products";
import { MapPin, Globe, Heart } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { toggleListingFavorite, isListingFavorite } from "../actions/favorites";
import { useSession } from "@/lib/auth-client";
import {
  addGuestFavorite,
  removeGuestFavorite,
  isGuestFavorite,
} from "@/lib/guest-favorites";
import toast from "react-hot-toast";

interface ProductCardProps {
  product: PublicProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations("products");
  const router = useRouter();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [isFavorite, setIsFavorite] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Safety check
  if (!product || !product.id) {
    return null;
  }

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (isAuthenticated) {
        const favorite = await isListingFavorite(product.id);
        setIsFavorite(favorite);
      } else {
        // Check localStorage for guest favorites
        const guestFavorite = isGuestFavorite("product", product.id);
        setIsFavorite(guestFavorite);
      }
      setIsLoading(false);
    };
    checkFavoriteStatus();
  }, [product.id, isAuthenticated]);

  const handleStoreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.storeSlug) {
      router.push(`/store/${product.storeSlug}`);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsToggling(true);
    try {
      if (isAuthenticated) {
        // Use server action for authenticated users
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
        // Use localStorage for guest users
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

  return (
    <Link href={`/products/${product.slug || product.id}`}>
      <Card className="group overflow-hidden border-border hover:shadow-xl transition-all duration-300 relative shadow-md">
        <CardContent className="p-0">
          <div className="aspect-square relative overflow-hidden bg-muted">
            <Image
              src={product.imageUrl || "/product-placeholder.jpg"}
              alt={product.name || "Product Image"}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
            {/* Heart Icon Overlay */}
            <button
              onClick={handleFavoriteClick}
              disabled={isToggling || isLoading}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white disabled:opacity-50"
            >
              <Heart
                className={`w-5 h-5 transition-all duration-200 ${
                  isFavorite
                    ? "fill-primary text-primary"
                    : "text-gray-700"
                }`}
                style={{ 
                  filter: isFavorite ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" 
                }}
              />
            </button>
          </div>
          <div className="p-4">
            <div className="flex gap-2 mb-2 flex-wrap">
              {product.categoryName && (
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {product.categoryName}
                </span>
              )}
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
                  {product.marketType === "local"
                    ? t("local")
                    : t("international")}
                </span>
              )}
            </div>
            <h3 className="font-medium text-base mb-1 text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {product.name}
            </h3>
            {product.storeName && product.storeSlug && (
              <button
                onClick={handleStoreClick}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors mb-2 block text-left truncate"
              >
                {product.storeName}
              </button>
            )}
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-lg font-semibold text-foreground">
                {product.currency} {parseFloat(product.price || "0").toFixed(2)}
              </p>
              {(() => {
                const comparePrice = product.compareAtPrice
                  ? parseFloat(product.compareAtPrice)
                  : null;
                const currentPrice = parseFloat(product.price || "0");

                if (
                  comparePrice !== null &&
                  !isNaN(comparePrice) &&
                  !isNaN(currentPrice) &&
                  comparePrice > currentPrice
                ) {
                  const savings = comparePrice - currentPrice;
                  return (
                    <div className="flex flex-col">
                      <span className="bg-accent text-accent-foreground px-2 py-0.5 text-xs font-semibold rounded">
                        SAVE {product.currency} {savings.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        Regular {product.currency}{" "}
                        {comparePrice.toFixed(2)}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
