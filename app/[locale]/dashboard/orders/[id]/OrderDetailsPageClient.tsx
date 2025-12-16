"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  MoreVertical,
  Printer,
  Edit,
  RefreshCw,
  Package,
  CreditCard,
  MapPin,
  User,
  Tag,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { format } from "date-fns";
import Image from "next/image";
import { FulfillmentCard } from "./components/FulfillmentCard";
import { PaymentSummary } from "./components/PaymentSummary";
import { OrderTimeline } from "./components/OrderTimeline";
import { OrderSidebar } from "./components/OrderSidebar";

interface OrderItem {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  lineTotal: string;
  currency: string;
  imageUrl: string | null;
}

interface OrderEvent {
  id: string;
  type: string;
  visibility: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: Date;
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
  archivedAt: Date | null;
  internalNote: string | null;
  notes: string | null;
  tags: string | null;
  shippingMethod: string | null;
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
  paidAt: Date | null;
  fulfilledAt: Date | null;
  canceledAt: Date | null;
  items: OrderItem[];
  events: OrderEvent[];
}

interface OrderDetailsPageClientProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
}

export default function OrderDetailsPageClient({
  orderData,
  userRole,
}: OrderDetailsPageClientProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const customerName =
    orderData.customerFirstName || orderData.customerLastName
      ? `${orderData.customerFirstName || ""} ${orderData.customerLastName || ""}`.trim()
      : orderData.customerEmail || "N/A";

  // Determine action permissions based on role and order state
  const isArchived = orderData.archivedAt !== null || orderData.status === "archived";
  const isPaid = orderData.paymentStatus === "paid" || orderData.paymentStatus === "partially_refunded";
  const isFulfilled = orderData.fulfillmentStatus === "fulfilled";
  const canRefund = (userRole === "admin" || userRole === "seller") && isPaid && !isArchived;
  const canEdit = userRole === "admin" && !isFulfilled && !isArchived;
  const canFulfill = (userRole === "admin" || userRole === "seller") && isPaid && !isFulfilled && !isArchived;

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      partially_refunded: "bg-orange-100 text-orange-800",
      refunded: "bg-red-100 text-red-800",
      failed: "bg-red-100 text-red-800",
      void: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.pending;
  };

  const getFulfillmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unfulfilled: "bg-yellow-100 text-yellow-800",
      partial: "bg-orange-100 text-orange-800",
      fulfilled: "bg-green-100 text-green-800",
      canceled: "bg-red-100 text-red-800",
      on_hold: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.unfulfilled;
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // TODO: Implement refresh logic
    setTimeout(() => setRefreshing(false), 1000);
  };

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
            Orders
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Order #{orderData.orderNumber}</h1>
              <Badge className={getPaymentStatusColor(orderData.paymentStatus)}>
                {orderData.paymentStatus.replace(/_/g, " ")}
              </Badge>
              <Badge className={getFulfillmentStatusColor(orderData.fulfillmentStatus)}>
                {orderData.fulfillmentStatus.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {orderData.placedAt
                ? format(new Date(orderData.placedAt), "MMM dd, yyyy 'at' HH:mm")
                : format(new Date(orderData.createdAt), "MMM dd, yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {canRefund && (
            <Button variant="outline" size="sm">
              <CreditCard className="mr-2 h-4 w-4" />
              Refund
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {(userRole === "admin" || userRole === "seller") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Archive order</DropdownMenuItem>
                <DropdownMenuItem>Cancel order</DropdownMenuItem>
                <DropdownMenuItem>Duplicate order</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fulfillment Card */}
          <FulfillmentCard
            orderData={orderData}
            userRole={userRole}
            canFulfill={canFulfill}
          />

          {/* Payment Summary */}
          <PaymentSummary orderData={orderData} userRole={userRole} />

          {/* Timeline */}
          <OrderTimeline
            orderId={orderData.id}
            events={orderData.events}
            userRole={userRole}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <OrderSidebar
            orderData={orderData}
            userRole={userRole}
            customerName={customerName}
          />
        </div>
      </div>
    </div>
  );
}

