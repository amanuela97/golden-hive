"use client";

import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function CartPage() {
  const { items, updateQuantity, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Cart</h1>
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground mb-8">
              Your cart is currently empty.
            </p>
            <Button asChild size="lg">
              <Link href="/products">Return to shop</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8 text-foreground">Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b border-border font-medium text-sm">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Price</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Subtotal</div>
              </div>

              {/* Cart Items */}
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Product Info */}
                      <div className="md:col-span-6 flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden bg-muted">
                          <Image
                            src={item.image || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.id}`}
                            className="font-medium text-foreground hover:text-primary line-clamp-2"
                          >
                            {item.name}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.category}
                          </p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="md:col-span-2 flex md:justify-center">
                        <div className="md:hidden font-medium text-sm text-muted-foreground mr-2">
                          Price:
                        </div>
                        <span className="text-foreground font-medium">
                          {item.currency || "NPR"} {item.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-2 flex md:justify-center">
                        <div className="md:hidden font-medium text-sm text-muted-foreground mr-2">
                          Quantity:
                        </div>
                        <div className="flex items-center border border-border rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="h-9 w-9"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = Number.parseInt(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                updateQuantity(item.id, value);
                              }
                            }}
                            className="w-12 text-center border-x border-border bg-transparent text-foreground text-sm"
                            min="0"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="h-9 w-9"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="md:col-span-2 flex md:justify-end">
                        <div className="md:hidden font-medium text-sm text-muted-foreground mr-2">
                          Subtotal:
                        </div>
                        <span className="text-foreground font-semibold">
                          {item.currency || "NPR"}{" "}
                          {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Totals */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border border-border p-6 sticky top-4">
              <h2 className="text-2xl font-bold mb-6 text-foreground">
                Cart totals
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">
                    €{total.toFixed(2)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-foreground">
                    €{total.toFixed(2)}
                  </span>
                </div>

                <Button asChild className="w-full mt-6" size="lg">
                  <Link href="/checkout">Proceed to checkout</Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full bg-transparent"
                >
                  <Link href="/products">Continue shopping</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
