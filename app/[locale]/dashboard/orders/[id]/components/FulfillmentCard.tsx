"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Truck, ChevronDown, Star } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import toast from "react-hot-toast";
import { updateFulfillmentStatus } from "@/app/[locale]/actions/orders";
import { fulfillOrder } from "@/app/[locale]/actions/orders-fulfillment";
import { updateWorkflowStatus } from "@/app/[locale]/actions/orders-workflow";

interface OrderItem {
  id: string;
  listingId: string | null;
  listingSlug: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  fulfilledQuantity?: number; // How many have been fulfilled
  unitPrice: string;
  lineSubtotal: string;
  lineTotal: string;
  currency: string;
  imageUrl: string | null;
}

interface OrderData {
  id: string;
  orderNumber: string | number;
  fulfillmentStatus: string;
  paymentStatus: string;
  shippingMethod: string | null;
  items: OrderItem[];
}

interface FulfillmentCardProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
  canFulfill: boolean;
  isArchived?: boolean;
  isCanceled?: boolean;
}

const shippingCarriers = [
  "USPS",
  "FedEx",
  "UPS",
  "DHL",
  "Canada Post",
  "Royal Mail",
  "Other",
];

const holdReasons = [
  "inventory out of stock",
  "address incorrect",
  "high risk of fraud",
  "awaiting payment",
  "other",
];

export function FulfillmentCard({
  orderData,
  canFulfill,
  isArchived = false,
  isCanceled = false,
}: FulfillmentCardProps) {
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);

  // Fulfill dialog state
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
    {}
  );
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");

  // On hold dialog state
  const [onHoldItems, setOnHoldItems] = useState<Record<string, number>>({});
  const [holdReason, setHoldReason] = useState("");
  const [holdNote, setHoldNote] = useState("");

  const isFulfilled = orderData.fulfillmentStatus === "fulfilled";
  const isPartiallyFulfilled = orderData.fulfillmentStatus === "partial";
  const workflowStatus = orderData.workflowStatus || "normal";
  const isOnHold = workflowStatus === "on_hold";
  const isInProgress = workflowStatus === "in_progress";

  const getStatusBadge = () => {
    if (isFulfilled) {
      return <Badge className="bg-green-100 text-green-800">Fulfilled</Badge>;
    }
    if (isPartiallyFulfilled) {
      return (
        <Badge className="bg-orange-100 text-orange-800">
          Partially Fulfilled
        </Badge>
      );
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Unfulfilled</Badge>;
  };

  const getWorkflowBadge = () => {
    if (isOnHold) {
      return (
        <Badge className="bg-red-100 text-red-800">
          On Hold{orderData.holdReason ? `: ${orderData.holdReason}` : ""}
        </Badge>
      );
    }
    if (isInProgress) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    }
    return null;
  };

  const handleResetWorkflowStatus = async () => {
    try {
      const result = await updateWorkflowStatus({
        orderId: orderData.id,
        workflowStatus: "normal",
      });
      if (result.success) {
        toast.success("Workflow status reset to normal");
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to reset workflow status");
      }
    } catch (error) {
      console.error("Error resetting workflow status:", error);
      toast.error("Failed to reset workflow status");
    }
  };

  // Initialize selected items when dialog opens
  // Pre-fill with remaining unfulfilled quantities
  const handleFulfillClick = () => {
    const initial: Record<string, number> = {};
    orderData.items.forEach((item) => {
      const fulfilledQty = item.fulfilledQuantity || 0;
      const remainingQty = item.quantity - fulfilledQty;
      // Pre-select remaining quantity (or 0 if already fully fulfilled)
      initial[item.id] = remainingQty > 0 ? remainingQty : 0;
    });
    setSelectedItems(initial);
    setShowFulfillDialog(true);
  };

  const handleInProgressClick = async () => {
    try {
      const result = await updateWorkflowStatus({
        orderId: orderData.id,
        workflowStatus: "in_progress",
      });
      if (result.success) {
        toast.success("Order marked as in progress");
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleOnHoldClick = () => {
    const initial: Record<string, number> = {};
    orderData.items.forEach((item) => {
      initial[item.id] = item.quantity;
    });
    setOnHoldItems(initial);
    setShowOnHoldDialog(true);
  };

  const handleFulfillSubmit = async () => {
    if (!shippingCarrier) {
      toast.error("Please select a shipping carrier");
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    // Build fulfilledItems array from selected items
    const fulfilledItems = Object.entries(selectedItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
      }));

    if (fulfilledItems.length === 0) {
      toast.error("Please select at least one item to fulfill");
      return;
    }

    try {
      const result = await fulfillOrder({
        orderId: orderData.id,
        fulfilledItems,
        carrier: shippingCarrier,
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingNumber.trim() ? undefined : undefined, // Could add tracking URL field later
        fulfilledBy: "seller", // Could make this configurable later
      });

      if (result.success) {
        toast.success("Order fulfilled successfully");
        setShowFulfillDialog(false);
        setTrackingNumber("");
        setShippingCarrier("");
        setSelectedItems({});
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to fulfill order");
      }
    } catch (error) {
      console.error("Error fulfilling order:", error);
      toast.error("Failed to fulfill order");
    }
  };

  const handleOnHoldSubmit = async () => {
    if (!holdReason) {
      toast.error("Please select a hold reason");
      return;
    }
    if (holdReason === "other" && !holdNote.trim()) {
      toast.error("Please provide a note for the hold reason");
      return;
    }

    try {
      const finalReason = holdReason === "other" ? holdNote.trim() : holdReason;
      const result = await updateWorkflowStatus({
        orderId: orderData.id,
        workflowStatus: "on_hold",
        holdReason: finalReason,
      });
      if (result.success) {
        toast.success("Order placed on hold");
        setShowOnHoldDialog(false);
        setHoldReason("");
        setHoldNote("");
        setOnHoldItems({});
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to place order on hold");
      }
    } catch (error) {
      console.error("Error placing order on hold:", error);
      toast.error("Failed to place order on hold");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>Fulfillment</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {getWorkflowBadge()}
              {(isOnHold || isInProgress) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetWorkflowStatus}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Fulfillment Type
            </p>
            <p className="font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {orderData.shippingMethod || "Standard Shipping"}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Order Items</p>
            <div className="space-y-2">
              {orderData.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg border"
                >
                  {item.imageUrl ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-md border">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">
                      Qty: {item.quantity}
                      {item.fulfilledQuantity !== undefined &&
                        item.fulfilledQuantity > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({item.fulfilledQuantity} fulfilled)
                          </span>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.currency} {parseFloat(item.unitPrice).toFixed(2)}
                    </p>
                    {orderData.paymentStatus === "paid" && item.listingId && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="mt-2 gap-1"
                      >
                        <Link href={`/review?order=${orderData.id}&product=${item.listingId}`}>
                          <Star className="h-3 w-3" />
                          Review
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canFulfill && !isFulfilled && !isArchived && !isCanceled && !isOnHold && (
            <div className="flex gap-2">
              <Button onClick={handleFulfillClick} className="flex-1">
                Mark as fulfilled
              </Button>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value === "in_progress") {
                    handleInProgressClick();
                  } else if (value === "on_hold") {
                    handleOnHoldClick();
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="More actions">
                    <ChevronDown className="h-4 w-4" />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">
                    Mark as in progress
                  </SelectItem>
                  <SelectItem value="on_hold">Mark as on hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fulfill Dialog */}
      <Dialog open={showFulfillDialog} onOpenChange={setShowFulfillDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark as Fulfilled</DialogTitle>
            <DialogDescription>
              Select items and quantities to fulfill, then add tracking
              information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Items Selection */}
            <div>
              <Label className="mb-2 block">Items to Fulfill</Label>
              <div className="space-y-2">
                {orderData.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <Checkbox
                      checked={selectedItems[item.id] > 0}
                      onCheckedChange={(checked) => {
                        setSelectedItems((prev) => ({
                          ...prev,
                          [item.id]: checked ? item.quantity : 0,
                        }));
                      }}
                    />
                    {item.imageUrl ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border">
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    {selectedItems[item.id] > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedItems[item.id] > 0) {
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] - 1,
                              }));
                            }
                          }}
                        >
                          -
                        </Button>
                        <span className="w-16 text-center text-sm">
                          {selectedItems[item.id]} / {item.quantity}
                          {item.fulfilledQuantity !== undefined &&
                            item.fulfilledQuantity > 0 && (
                              <span className="block text-xs text-muted-foreground">
                                ({item.fulfilledQuantity} already fulfilled)
                              </span>
                            )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const fulfilledQty = item.fulfilledQuantity || 0;
                            const maxQty = item.quantity - fulfilledQty;
                            if (selectedItems[item.id] < maxQty) {
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] + 1,
                              }));
                            }
                          }}
                        >
                          +
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Carrier and Tracking */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="carrier">Shipping Carrier</Label>
                <Select
                  value={shippingCarrier}
                  onValueChange={setShippingCarrier}
                >
                  <SelectTrigger id="carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingCarriers.map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>
                        {carrier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFulfillDialog(false);
                setTrackingNumber("");
                setShippingCarrier("");
                setSelectedItems({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleFulfillSubmit}>Mark as Fulfilled</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* On Hold Dialog */}
      <Dialog open={showOnHoldDialog} onOpenChange={setShowOnHoldDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark as On Hold</DialogTitle>
            <DialogDescription>
              Select items and quantities to put on hold, then provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Items Selection */}
            <div>
              <Label className="mb-2 block">Items to Put On Hold</Label>
              <div className="space-y-2">
                {orderData.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <Checkbox
                      checked={onHoldItems[item.id] > 0}
                      onCheckedChange={(checked) => {
                        setOnHoldItems((prev) => ({
                          ...prev,
                          [item.id]: checked ? item.quantity : 0,
                        }));
                      }}
                    />
                    {item.imageUrl ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-md border">
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.title}</p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>
                    {onHoldItems[item.id] > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (onHoldItems[item.id] > 1) {
                              setOnHoldItems((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] - 1,
                              }));
                            }
                          }}
                        >
                          -
                        </Button>
                        <span className="w-12 text-center text-sm">
                          {onHoldItems[item.id]} / {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (onHoldItems[item.id] < item.quantity) {
                              setOnHoldItems((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] + 1,
                              }));
                            }
                          }}
                        >
                          +
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hold Reason */}
            <div>
              <Label htmlFor="holdReason">Hold Reason</Label>
              <Select value={holdReason} onValueChange={setHoldReason}>
                <SelectTrigger id="holdReason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {holdReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason.charAt(0).toUpperCase() + reason.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note for "other" reason */}
            {holdReason === "other" && (
              <div>
                <Label htmlFor="holdNote">Note</Label>
                <Textarea
                  id="holdNote"
                  value={holdNote}
                  onChange={(e) => setHoldNote(e.target.value)}
                  placeholder="Please provide details..."
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOnHoldDialog(false);
                setHoldReason("");
                setHoldNote("");
                setOnHoldItems({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleOnHoldSubmit}>Mark as On Hold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
