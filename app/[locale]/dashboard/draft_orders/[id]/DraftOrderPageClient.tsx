"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DraftOrderActions from "./DraftOrderActions";
import CreateOrderForm, {
  type CreateOrderFormRef,
} from "../../orders/components/CreateOrderForm";
import { OrderTimeline } from "../../orders/[id]/components/OrderTimeline";
import Image from "next/image";

interface DraftOrderPageClientProps {
  draftId: string;
  draftNumber: number;
  customerEmail: string | null;
  userRole: "admin" | "seller" | "customer";
  isCompleted: boolean;
  completedAt: Date | null;
  convertedToOrderId: string | null;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  orderEvents?: Array<{
    id: string;
    type: string;
    visibility: string;
    message: string;
    metadata: Record<string, unknown> | null;
    createdBy: string | null;
    createdAt: Date;
  }>;
  initialData: {
    customerId: string | null;
    customerEmail: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerPhone: string | null;
    lineItems: Array<{
      id: string;
      listingId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: string;
      title: string;
      sku: string | null;
      listingName: string;
      variantTitle: string;
      imageUrl?: string | null;
      variantImageUrl?: string | null;
      currency: string;
      originalCurrency: string;
      originalUnitPrice: string;
      available: number;
    }>;
    currency: string;
    shippingName: string | null;
    shippingPhone: string | null;
    shippingAddressLine1: string | null;
    shippingAddressLine2: string | null;
    shippingCity: string | null;
    shippingRegion: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    billingName: string | null;
    billingPhone: string | null;
    billingAddressLine1: string | null;
    billingAddressLine2: string | null;
    billingCity: string | null;
    billingRegion: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
    paymentStatus: "pending" | "paid";
    marketId: string | null;
  };
}

export default function DraftOrderPageClient({
  draftId,
  draftNumber,
  customerEmail,
  userRole,
  isCompleted,
  completedAt,
  convertedToOrderId,
  subtotalAmount,
  discountAmount,
  shippingAmount,
  taxAmount,
  totalAmount,
  currency,
  orderEvents = [],
  initialData,
}: DraftOrderPageClientProps) {
  // Start with false to ensure buttons don't show on initial load
  const [isFormModified, setIsFormModified] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const formRef = useRef<CreateOrderFormRef>(null);

  const handleSave = () => {
    if (formRef.current) {
      formRef.current.triggerSave();
    }
  };

  const handleLoadingChange = (loading: boolean) => {
    setFormLoading(loading);
  };

  const handleCancel = () => {
    if (formRef.current) {
      formRef.current.triggerCancel();
    }
  };

  return (
    <div className="space-y-6">
      {/* Completed Banner */}
      {isCompleted && (
        <Alert className="bg-green-50 border-green-200 text-green-900">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Completed</span>
            {completedAt && (
              <span>
                Order created on{" "}
                {format(new Date(completedAt), "MMM dd, yyyy, h:mm a")}.
              </span>
            )}
            <span>You can</span>
            {convertedToOrderId ? (
              <Button
                asChild
                variant="link"
                className="h-auto p-0 text-green-700 underline font-semibold"
              >
                <Link href={`/dashboard/orders/${convertedToOrderId}`}>
                  view the order
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="link"
                className="h-auto p-0 text-green-700 underline font-semibold"
              >
                <Link href="/dashboard/orders">view the order</Link>
              </Button>
            )}
            <span>or create a</span>
            <Button
              asChild
              variant="link"
              className="h-auto p-0 text-green-700 underline font-semibold"
            >
              <Link href="/dashboard/orders/new">new order</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header with actions - only show if not completed */}
      {!isCompleted && (
        <DraftOrderActions
          draftId={draftId}
          draftNumber={draftNumber}
          customerEmail={customerEmail}
          userRole={userRole}
          isFormModified={isFormModified}
          onSave={handleSave}
          onCancel={handleCancel}
          formLoading={formLoading}
          actionLoading={actionLoading}
        />
      )}

      {/* Show read-only view for completed drafts */}
      {isCompleted ? (
        <div className="space-y-6">
          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialData.lineItems.map((item) => {
                    const itemTotal =
                      parseFloat(item.unitPrice) * item.quantity;
                    // Use variant image if available, otherwise use main image
                    const productImage =
                      item.variantImageUrl || item.imageUrl || null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {productImage && (
                              <Image
                                width={48}
                                height={48}
                                quality={100}
                                priority
                                src={productImage}
                                alt={item.listingName}
                                className="w-12 h-12 object-cover rounded border"
                              />
                            )}
                            <div className="space-y-1">
                              <div className="font-medium">
                                {item.listingName}
                              </div>
                              {item.variantTitle &&
                                item.variantTitle !== item.listingName && (
                                  <div className="text-sm text-muted-foreground">
                                    {item.variantTitle}
                                  </div>
                                )}
                              <div className="text-sm text-muted-foreground">
                                {currency}{" "}
                                {parseFloat(item.unitPrice).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          {currency} {itemTotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>
                  Subtotal ({initialData.lineItems.length} item
                  {initialData.lineItems.length !== 1 ? "s" : ""})
                </span>
                <span className="font-medium">
                  {currency} {parseFloat(subtotalAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <span className="font-medium">
                  {parseFloat(discountAmount) > 0 ? (
                    <>
                      -{currency} {parseFloat(discountAmount).toFixed(2)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No discount—</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span className="font-medium">
                  {parseFloat(shippingAmount) > 0 ? (
                    <>
                      {currency} {parseFloat(shippingAmount).toFixed(2)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No shipping—</span>
                  )}
                </span>
              </div>
              {parseFloat(taxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span className="font-medium">
                    {currency} {parseFloat(taxAmount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>
                  {currency} {parseFloat(totalAmount).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {convertedToOrderId &&
            Array.isArray(orderEvents) &&
            orderEvents.length > 0 && (
              <OrderTimeline
                orderId={convertedToOrderId}
                events={orderEvents}
                userRole={userRole}
              />
            )}
        </div>
      ) : (
        /* Form for non-completed drafts */
        <CreateOrderForm
          ref={formRef}
          userRole={userRole}
          cancelRedirectPath="/dashboard/draft_orders"
          draftId={draftId}
          initialData={initialData}
          showTopButtons={true}
          onFormModified={(modified) => {
            setIsFormModified(modified);
          }}
          onLoadingChange={handleLoadingChange}
          onActionLoadingChange={(loading) => {
            setActionLoading(loading);
          }}
        />
      )}
    </div>
  );
}
