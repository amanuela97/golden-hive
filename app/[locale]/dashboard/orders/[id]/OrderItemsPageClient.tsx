"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Star } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import Image from "next/image";

interface OrderItem {
  id: string;
  listingId: string | null;
  listingSlug: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  lineTotal: string;
  currency: string;
  imageUrl: string | null;
}

interface OrderData {
  id: string;
  orderNumber: number;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  placedAt: Date | null;
  createdAt: Date;
  items: OrderItem[];
}

interface OrderItemsPageClientProps {
  orderData: OrderData;
}

export default function OrderItemsPageClient({
  orderData,
}: OrderItemsPageClientProps) {
  const router = useRouter();

  const customerName =
    orderData.customerFirstName || orderData.customerLastName
      ? `${orderData.customerFirstName || ""} ${orderData.customerLastName || ""}`.trim()
      : orderData.customerEmail || "N/A";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/orders")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order Items</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Order #{orderData.orderNumber} • {orderData.items.length} item
              {orderData.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Order Information</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Number:</span>
              <span className="font-medium">#{orderData.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium capitalize">{orderData.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Status:</span>
              <span className="font-medium capitalize">
                {orderData.paymentStatus.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fulfillment Status:</span>
              <span className="font-medium capitalize">
                {orderData.fulfillmentStatus.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">
                {orderData.placedAt
                  ? format(new Date(orderData.placedAt), "MMM dd, yyyy HH:mm")
                  : format(new Date(orderData.createdAt), "MMM dd, yyyy HH:mm")}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium">{customerName}</span>
            </div>
            {orderData.customerEmail && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2 font-medium">
                  {orderData.customerEmail}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Order Items Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
        {orderData.items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No items in this order.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {orderData.paymentStatus === "paid" && (
                  <TableHead className="text-center">Review</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderData.items.map((item) => {
                const unitPrice = parseFloat(item.unitPrice);
                const lineSubtotal = parseFloat(item.lineSubtotal);
                const lineTotal = parseFloat(item.lineTotal);
                const canReview =
                  orderData.paymentStatus === "paid" && item.listingId;
                const reviewUrl = canReview
                  ? `/review?order=${orderData.id}&product=${item.listingId}`
                  : null;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.imageUrl ? (
                        <div className="relative h-16 w-16 overflow-hidden rounded-md border">
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            No image
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.sku || "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.currency} {unitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.currency} {lineSubtotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.currency} {lineTotal.toFixed(2)}
                    </TableCell>
                    {orderData.paymentStatus === "paid" && (
                      <TableCell className="text-center">
                        {reviewUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="gap-2"
                          >
                            <Link href={reviewUrl}>
                              <Star className="h-4 w-4" />
                              Review
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Order Totals */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">
              {orderData.currency}{" "}
              {parseFloat(orderData.subtotalAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount:</span>
            <span className="font-medium">
              {orderData.currency}{" "}
              {parseFloat(orderData.discountAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping:</span>
            <span className="font-medium">
              {orderData.currency}{" "}
              {parseFloat(orderData.shippingAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax:</span>
            <span className="font-medium">
              {orderData.currency} {parseFloat(orderData.taxAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-semibold pt-3 border-t">
            <span>Total:</span>
            <span>
              {orderData.currency}{" "}
              {parseFloat(orderData.totalAmount).toFixed(2)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
