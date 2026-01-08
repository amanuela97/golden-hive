"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { captureOrderPayment } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";

interface OrderData {
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentStatus: string;
  discount?: {
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    amount: number;
    currency: string;
  } | null;
}

interface PaymentSummaryProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
  orderId?: string; // Optional for draft orders
}

export function PaymentSummary({
  orderData,
  userRole,
  orderId,
}: PaymentSummaryProps) {
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);
  const isCustomer = userRole === "customer";
  const isPaid = orderData.paymentStatus === "paid";
  const isPending = orderData.paymentStatus === "pending";
  const isPartiallyRefunded = orderData.paymentStatus === "partially_refunded";
  const isRefunded = orderData.paymentStatus === "refunded";
  const canCapturePayment =
    (userRole === "admin" || userRole === "seller") && isPending && !!orderId; // Only allow capture if orderId is provided (not a draft)

  const subtotal = parseFloat(orderData.subtotalAmount);
  const discount = parseFloat(orderData.discountAmount);
  const shipping = parseFloat(orderData.shippingAmount);
  const tax = parseFloat(orderData.taxAmount);
  const total = parseFloat(orderData.totalAmount);

  const handleCapturePayment = async () => {
    if (!orderId) {
      toast.error("Cannot capture payment for draft orders");
      return;
    }
    setCapturing(true);
    try {
      const result = await captureOrderPayment(orderId);
      if (result.success) {
        toast.success("Payment captured successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to capture payment");
      }
    } catch (error) {
      console.error("Error capturing payment:", error);
      toast.error("Failed to capture payment");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>Payment Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isCustomer && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">
                {orderData.currency} {subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping:</span>
              <span className="font-medium">
                {orderData.currency} {shipping.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span className="font-medium">
                {orderData.currency} {tax.toFixed(2)}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex flex-col gap-1 border-t pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {orderData.discount?.name || "Discount"}
                    {orderData.discount?.code && (
                      <span className="ml-1 text-xs">
                        ({orderData.discount.code})
                      </span>
                    )}
                    :
                  </span>
                  <span className="font-medium text-green-600">
                    -{orderData.currency} {discount.toFixed(2)}
                  </span>
                </div>
                {orderData.discount && (
                  <div className="text-xs text-muted-foreground pl-1">
                    {orderData.discount.valueType === "percentage"
                      ? `${orderData.discount.value}% off`
                      : `${orderData.discount.currency} ${orderData.discount.value.toFixed(2)} off`}
                  </div>
                )}
              </div>
            )}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>
                  {orderData.currency} {total.toFixed(2)}
                </span>
              </div>
            </div>
            {isPaid && (
              <div className="flex justify-between text-sm text-green-600 pt-2 border-t">
                <span>Paid:</span>
                <span className="font-medium">
                  {orderData.currency} {total.toFixed(2)}
                </span>
              </div>
            )}
            {isPartiallyRefunded && (
              <div className="flex justify-between text-sm text-orange-600 pt-2 border-t">
                <span>Refunded:</span>
                <span className="font-medium">
                  {orderData.currency} {(total * 0.5).toFixed(2)}
                </span>
              </div>
            )}
            {isRefunded && (
              <div className="flex justify-between text-sm text-red-600 pt-2 border-t">
                <span>Refunded:</span>
                <span className="font-medium">
                  {orderData.currency} {total.toFixed(2)}
                </span>
              </div>
            )}
            {canCapturePayment && (
              <div className="pt-4 border-t mt-4">
                <Button
                  onClick={handleCapturePayment}
                  disabled={capturing}
                  className="w-full"
                  size="sm"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {capturing ? "Capturing..." : "Capture Payment"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Capture the authorized payment to complete the transaction
                </p>
              </div>
            )}
          </>
        )}
        {isCustomer && (
          <div className="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span>
              {orderData.currency} {total.toFixed(2)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
