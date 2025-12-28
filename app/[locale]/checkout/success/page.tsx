"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Star } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Link } from "@/i18n/navigation";

interface OrderItem {
  id: string;
  orderId?: string | null; // Order ID for this specific item (for multi-store orders)
  listingId: string | null;
  listingSlug: string | null;
  storeId: string | null;
  storeSlug: string | null;
  title: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  sku: string | null;
}

interface OrderData {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  status: string;
  customerEmail: string;
  items: OrderItem[];
}

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const sessionId = searchParams.get("session_id");
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear cart on success - this ensures cart is emptied after successful checkout
    clearCart();

    // Fetch order details if session_id is provided
    if (sessionId) {
      fetchOrderDetails(sessionId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function fetchOrderDetails(sessionId: string) {
    try {
      const response = await fetch(
        `/api/checkout/get-order-by-session?session_id=${sessionId}`
      );
      const data = await response.json();

      if (data.success && data.order) {
        setOrderData(data.order);
      } else {
        setError(data.error || "Failed to fetch order details");
      }
    } catch (err) {
      console.error("Error fetching order details:", err);
      setError("Failed to load order details");
    } finally {
      setLoading(false);
    }
  }

  function getReviewUrl(item: OrderItem, defaultOrderId: string) {
    if (!item.listingId) return null;
    // Use item's orderId if available (for multi-store orders), otherwise fall back to default orderId
    const orderId = item.orderId || defaultOrderId;
    const params = new URLSearchParams({
      order: orderId,
      product: item.listingId,
    });
    return `/review?${params.toString()}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isPaid = orderData?.paymentStatus === "paid";
  const reviewableItems = orderData?.items.filter(
    (item) => item.listingId && item.listingSlug && isPaid
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl">
                Order Confirmed!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Thank you for your purchase! Your order has been confirmed and will be processed shortly.
                </p>
                {orderData?.orderNumber && (
                  <p className="text-lg font-semibold">
                    Order Number: {orderData.orderNumber}
                  </p>
                )}
              </div>

              {/* Review Section for Paid Orders */}
              {isPaid && reviewableItems.length > 0 && (
                <div className="space-y-4 pt-6 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">Leave a Review</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share your experience with the products you purchased:
                  </p>
                  <div className="space-y-2">
                    {reviewableItems.slice(0, 3).map((item) => {
                      const reviewUrl = getReviewUrl(item, orderData.id);
                      if (!reviewUrl) return null;
                      return (
                        <Button
                          key={item.id}
                          asChild
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Link href={reviewUrl}>
                            <Star className="h-4 w-4 mr-2" />
                            Review {item.title}
                          </Link>
                        </Button>
                      );
                    })}
                  </div>
                  {reviewableItems.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {reviewableItems.length - 3} more item{reviewableItems.length - 3 > 1 ? "s" : ""} available for review
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4 pt-6 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  A confirmation email has been sent to your email address.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild className="flex-1">
                    <Link href="/products">Continue Shopping</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/dashboard/orders">View Orders</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

