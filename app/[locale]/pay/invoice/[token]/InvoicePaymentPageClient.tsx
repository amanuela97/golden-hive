"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, AlertCircle } from "lucide-react";
import { createInvoiceCheckoutSession } from "@/app/[locale]/actions/invoice-payment";
import toast from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoicePaymentPageClientProps {
  draftData: {
    id: string;
    draftNumber: number;
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
      const result = await createInvoiceCheckoutSession(token);
      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || "Failed to create payment session");
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
              <div className="space-y-2">
                {draftData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × {item.unitPrice}{" "}
                        {draftData.currency}
                      </p>
                    </div>
                    <p className="font-medium">
                      {item.lineTotal} {draftData.currency}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-2xl font-bold">
                {draftData.totalAmount} {draftData.currency}
              </span>
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

