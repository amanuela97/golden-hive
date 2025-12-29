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
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { format } from "date-fns";
import { Link } from "@/i18n/navigation";
import { deleteCustomer } from "@/app/[locale]/actions/customers";
import toast from "react-hot-toast";

interface CustomerData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  storeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalSpent: string;
    totalOrders: number;
    firstOrderDate: Date | null;
    lastOrderDate: Date | null;
    averageOrderValue: string;
  };
}

interface OrderData {
  id: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  status: string;
  createdAt: Date;
  itemsCount: number;
  stripeCheckoutSessionId?: string | null;
  isGrouped?: boolean;
  subOrders?: Array<{
    id: string;
    orderNumber: string;
    storeName?: string;
    totalAmount: string;
  }>;
}

interface CustomerDetailPageClientProps {
  customerData: CustomerData;
  ordersData: OrderData[];
  isAdmin: boolean;
}

export default function CustomerDetailPageClient({
  customerData,
  ordersData,
  isAdmin,
}: CustomerDetailPageClientProps) {
  const router = useRouter();

  const customerName = customerData.firstName || customerData.lastName
    ? `${customerData.firstName || ""} ${customerData.lastName || ""}`.trim()
    : customerData.email || "N/A";

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      return;
    }

    const result = await deleteCustomer(customerData.id);
    if (result.success) {
      toast.success("Customer deleted successfully");
      router.push("/dashboard/customers");
    } else {
      toast.error(result.error || "Failed to delete customer");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/customers")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{customerName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {customerData.email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/customers/${customerData.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {isAdmin && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-2 font-medium">{customerData.email}</span>
            </div>
            {customerData.phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <span className="ml-2 font-medium">{customerData.phone}</span>
              </div>
            )}
            {(customerData.addressLine1 ||
              customerData.city ||
              customerData.country) && (
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="ml-2 font-medium mt-1">
                  {customerData.addressLine1 && <div>{customerData.addressLine1}</div>}
                  {customerData.addressLine2 && <div>{customerData.addressLine2}</div>}
                  {(customerData.city || customerData.region || customerData.postalCode) && (
                    <div>
                      {customerData.city}
                      {customerData.region && `, ${customerData.region}`}
                      {customerData.postalCode && ` ${customerData.postalCode}`}
                    </div>
                  )}
                  {customerData.country && <div>{customerData.country}</div>}
                </div>
              </div>
            )}
          </div>
          {customerData.notes && (
            <div>
              <span className="text-muted-foreground text-sm">Notes:</span>
              <div className="mt-1 text-sm">{customerData.notes}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total Spent</div>
          <div className="text-2xl font-bold mt-1">
            {parseFloat(customerData.stats.totalSpent).toFixed(2)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total Orders</div>
          <div className="text-2xl font-bold mt-1">
            {customerData.stats.totalOrders}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Average Order Value</div>
          <div className="text-2xl font-bold mt-1">
            {parseFloat(customerData.stats.averageOrderValue).toFixed(2)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">First Order</div>
          <div className="text-sm font-medium mt-1">
            {customerData.stats.firstOrderDate
              ? format(new Date(customerData.stats.firstOrderDate), "MMM dd, yyyy")
              : "Never"}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Last Order</div>
          <div className="text-sm font-medium mt-1">
            {customerData.stats.lastOrderDate
              ? format(new Date(customerData.stats.lastOrderDate), "MMM dd, yyyy")
              : "Never"}
          </div>
        </Card>
      </div>

      {/* Order History */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Order History</h2>
        {ordersData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No orders found for this customer.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Fulfillment Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersData.map((order) => (
                <React.Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      {order.isGrouped ? (
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Order Group #{order.orderNumber}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {order.subOrders?.length || 0} stores
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {order.paymentStatus.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {order.fulfillmentStatus.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.currency} {parseFloat(order.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.itemsCount}
                    </TableCell>
                  </TableRow>
                  {order.isGrouped && order.subOrders && order.subOrders.length > 0 && (
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={6} className="py-2">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
                            View {order.subOrders.length} sub-order{order.subOrders.length > 1 ? 's' : ''}
                          </summary>
                          <div className="mt-2 space-y-2 pl-4">
                            {order.subOrders.map((subOrder) => (
                              <div
                                key={subOrder.id}
                                className="flex items-center justify-between text-sm border-l-2 border-border pl-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/dashboard/orders/${subOrder.id}`}
                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    #{subOrder.orderNumber}
                                  </Link>
                                  {subOrder.storeName && (
                                    <span className="text-muted-foreground">
                                      • {subOrder.storeName}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium">
                                  {order.currency} {parseFloat(subOrder.totalAmount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

