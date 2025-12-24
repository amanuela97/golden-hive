"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, AlertCircle } from "lucide-react";
// Checkout is now handled via API route
import toast from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoicePaymentPageClientProps {
  draftData: {
    id: string;
    draftNumber: number;
    subtotalAmount: string;
    discountAmount: string;
    shippingAmount: string;
    taxAmount: string;
    totalAmount: string;
    currency: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    items: Array<{
      title: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
      imageUrl: string | null;
      productName: string;
      variantName: string | null;
    }>;
  };
  token: string;
  canceled: boolean;
}

export default function InvoicePaymentPageClient({
  draftData,
  token,
  canceled,
}: InvoicePaymentPageClientProps) {
  const [loading, setLoading] = useState(false);

  const handlePayNow = async () => {
    setLoading(true);
    try {
      // Call API route directly
      const response = await fetch("/api/stripe/checkout/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to create payment session");
        return;
      }

      if (data.url || data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.url || data.checkoutUrl;
      } else {
        toast.error("Failed to get checkout URL");
      }
    } catch (error) {
      toast.error("Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const customerName =
    draftData.customerFirstName && draftData.customerLastName
      ? `${draftData.customerFirstName} ${draftData.customerLastName}`
      : draftData.customerEmail || "Customer";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Invoice #{draftData.draftNumber}</CardTitle>
            {canceled && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment was canceled. You can try again below.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Bill To:</p>
              <p className="font-medium">{customerName}</p>
              {draftData.customerEmail && (
                <p className="text-sm text-muted-foreground">
                  {draftData.customerEmail}
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-3">
                {draftData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 items-start py-3 border-b"
                  >
                    {item.imageUrl && (
                      <img 
                        src={item.imageUrl} 
                        alt={item.productName}
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.productName}</p>
                      {item.variantName && (
                        <p className="text-sm text-muted-foreground">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Qty: {item.quantity} × {item.unitPrice}{" "}
                        {draftData.currency}
                      </p>
                    </div>
                    <p className="font-medium flex-shrink-0">
                      {item.lineTotal} {draftData.currency}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">
                  {draftData.subtotalAmount} {draftData.currency}
                </span>
              </div>
              {parseFloat(draftData.discountAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="font-medium text-green-600">
                    -{draftData.discountAmount} {draftData.currency}
                  </span>
                </div>
              )}
              {parseFloat(draftData.shippingAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span className="font-medium">
                    {draftData.shippingAmount} {draftData.currency}
                  </span>
                </div>
              )}
              {parseFloat(draftData.taxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">
                    {draftData.taxAmount} {draftData.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold">
                  {draftData.totalAmount} {draftData.currency}
                </span>
              </div>
            </div>

            <Button
              onClick={handlePayNow}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {loading ? "Processing..." : "Pay Now"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment powered by Stripe
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

