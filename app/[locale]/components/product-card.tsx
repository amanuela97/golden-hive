"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { PublicProduct } from "../actions/public-products";
import { MapPin, Globe } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface ProductCardProps {
  product: PublicProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations("products");

  return (
    <Link href={`/products/${product.id}`}>
      <Card className="group overflow-hidden border-border hover:shadow-lg transition-shadow duration-300 relative">
        <CardContent className="p-0">
          <div className="aspect-square relative overflow-hidden bg-muted">
            <Image
              src={product.imageUrl || "/placeholder.svg"}
              alt={product.name || "Product Image"}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="p-6">
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
            <h3 className="font-medium text-lg mb-2 text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="text-xl font-semibold text-foreground">
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
                      <span className="bg-yellow-400 text-yellow-900 px-2 py-1 text-sm font-semibold rounded">
                        SAVE {product.currency} {savings.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Regular price {product.currency}{" "}
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
