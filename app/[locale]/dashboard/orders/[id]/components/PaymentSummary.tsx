"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard } from "lucide-react";

interface OrderData {
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentStatus: string;
}

interface PaymentSummaryProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
}

export function PaymentSummary({
  orderData,
  userRole,
}: PaymentSummaryProps) {
  const isCustomer = userRole === "customer";
  const isPaid = orderData.paymentStatus === "paid";
  const isPartiallyRefunded = orderData.paymentStatus === "partially_refunded";
  const isRefunded = orderData.paymentStatus === "refunded";

  const subtotal = parseFloat(orderData.subtotalAmount);
  const discount = parseFloat(orderData.discountAmount);
  const shipping = parseFloat(orderData.shippingAmount);
  const tax = parseFloat(orderData.taxAmount);
  const total = parseFloat(orderData.totalAmount);

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
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium text-green-600">
                  -{orderData.currency} {discount.toFixed(2)}
                </span>
              </div>
            )}
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

