"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function CheckoutCancelPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <CardTitle className="text-3xl">Order Canceled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Your checkout was canceled. No payment has been processed.
                </p>
                {orderId && (
                  <p className="text-sm text-muted-foreground">
                    Order ID: {orderId}
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  If you encountered any issues, please try again or contact support.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild className="flex-1">
                    <Link href="/checkout">Retry Checkout</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/products">Continue Shopping</Link>
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
