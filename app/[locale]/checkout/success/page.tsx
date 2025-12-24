"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Link } from "@/i18n/navigation";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const sessionId = searchParams.get("session_id");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear cart on success - this ensures cart is emptied after successful checkout
    // This runs immediately when the success page loads
    clearCart();

    // Fetch order details if session_id is provided
    if (sessionId) {
      // In a real implementation, you might want to fetch order details from your API
      // For now, we'll just set loading to false
      setLoading(false);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once when component mounts - cart should be cleared immediately

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
                {orderNumber && (
                  <p className="text-lg font-semibold">
                    Order Number: #{orderNumber}
                  </p>
                )}
              </div>

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

