import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { PublicProduct } from "@/app/actions/public-products";
import { MapPin, Globe } from "lucide-react";

interface ProductCardProps {
  product: PublicProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`}>
      <Card className="group overflow-hidden border-border hover:shadow-lg transition-shadow duration-300">
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
                  {product.marketType === "local" ? "Local" : "International"}
                </span>
              )}
            </div>
            <h3 className="font-medium text-lg mb-2 text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="text-xl font-semibold text-foreground">
              {product.currency} {parseFloat(product.price).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
