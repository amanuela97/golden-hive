"use client";

import { useState } from "react";
import { getShippingAddresses } from "@/app/[locale]/actions/shipping-labels";
import { getShippingPackages } from "@/app/[locale]/actions/shipping-packages";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, ChevronDown, Star } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import toast from "react-hot-toast";
import { updateWorkflowStatus } from "@/app/[locale]/actions/orders-workflow";
import { BuyShippingLabelDialog } from "./BuyShippingLabelDialog";
import { ManualShippingDialog } from "./ManualShippingDialog";

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
  orderNumber: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  shippingMethod: string | null;
  workflowStatus?: string;
  holdReason?: string | null;
  storeId?: string | null;
  items: OrderItem[];
  // Shipping address (for Buy Label dialog prefill)
  shippingName?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  shippingPhone?: string | null;
  // Fulfillment info
  trackingNumber?: string | null;
  carrier?: string | null;
  labelUrl?: string | null;
  labelFileType?: string | null;
}

interface FulfillmentCardProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
  canFulfill: boolean;
  isArchived?: boolean;
  isCanceled?: boolean;
}

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
  const [showOnHoldDialog, setShowOnHoldDialog] = useState(false);
  const [showBuyLabelDialog, setShowBuyLabelDialog] = useState(false);
  const [showManualShippingDialog, setShowManualShippingDialog] =
    useState(false);
  const [buyLabelLoading, setBuyLabelLoading] = useState(false);
  const [prefetchedAddresses, setPrefetchedAddresses] = useState<{
    fromAddress: {
      street1: string;
      street2?: string;
      city: string;
      state?: string;
      zip: string;
      country: string;
      phone?: string;
    };
    toAddress: {
      street1: string;
      street2?: string;
      city: string;
      state?: string;
      zip: string;
      country: string;
      phone?: string;
    };
  } | null>(null);
  const [prefetchedPackages, setPrefetchedPackages] = useState<
    Array<{
      id: string;
      name: string;
      lengthIn: number;
      widthIn: number;
      heightIn: number;
      weightOz: number;
    }>
  >([]);

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
                        <Link
                          href={`/review?order=${orderData.id}&product=${item.listingId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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

          {/* Shipping Label Info */}
          {orderData.trackingNumber && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Tracking Information</p>
              <p className="text-sm text-muted-foreground">
                Carrier: {orderData.carrier || "N/A"}
              </p>
              <p className="text-sm text-muted-foreground">
                Tracking: {orderData.trackingNumber}
              </p>
              {orderData.labelUrl && (
                <div className="mt-2">
                  {orderData.labelFileType === "application/pdf" ? (
                    <a
                      href={orderData.labelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Download Shipping Label (PDF)
                    </a>
                  ) : (
                    <Image
                      src={orderData.labelUrl}
                      alt="Shipping label"
                      className="max-w-full h-auto"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {canFulfill &&
            !isFulfilled &&
            !isArchived &&
            !isCanceled &&
            !isOnHold && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      if (!orderData.storeId) return;
                      // Reuse cached data when reopening so we don't show loading again
                      if (prefetchedAddresses != null) {
                        setShowBuyLabelDialog(true);
                        return;
                      }
                      setBuyLabelLoading(true);
                      try {
                        const [addrRes, pkgRes] = await Promise.all([
                          getShippingAddresses({
                            orderId: orderData.id,
                            storeId: orderData.storeId,
                          }),
                          getShippingPackages(),
                        ]);
                        if (addrRes.success && addrRes.fromAddress && addrRes.toAddress) {
                          setPrefetchedAddresses({
                            fromAddress: {
                              street1: addrRes.fromAddress.street1 ?? "",
                              street2: addrRes.fromAddress.street2,
                              city: addrRes.fromAddress.city ?? "",
                              state: addrRes.fromAddress.state,
                              zip: addrRes.fromAddress.zip ?? "",
                              country: addrRes.fromAddress.country ?? "",
                              phone: addrRes.fromAddress.phone,
                            },
                            toAddress: {
                              street1: addrRes.toAddress.street1 ?? "",
                              street2: addrRes.toAddress.street2,
                              city: addrRes.toAddress.city ?? "",
                              state: addrRes.toAddress.state,
                              zip: addrRes.toAddress.zip ?? "",
                              country: addrRes.toAddress.country ?? "",
                              phone: addrRes.toAddress.phone,
                            },
                          });
                        } else {
                          setPrefetchedAddresses(null);
                        }
                        if (pkgRes.success && pkgRes.data) {
                          setPrefetchedPackages(
                            pkgRes.data.map((p) => ({
                              id: p.id,
                              name: p.name,
                              lengthIn: p.lengthIn,
                              widthIn: p.widthIn,
                              heightIn: p.heightIn,
                              weightOz: p.weightOz,
                            }))
                          );
                        } else {
                          setPrefetchedPackages([]);
                        }
                        setShowBuyLabelDialog(true);
                      } finally {
                        setBuyLabelLoading(false);
                      }
                    }}
                    disabled={buyLabelLoading}
                    className="flex-1"
                  >
                    {buyLabelLoading ? "Loading…" : "Buy Shipping Label"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowManualShippingDialog(true)}
                    className="flex-1"
                  >
                    Mark as Shipped Manually
                  </Button>
                </div>
                <div className="flex gap-2">
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
              </div>
            )}
        </CardContent>
      </Card>

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

      {/* Buy Shipping Label Dialog */}
      {orderData.storeId && (
        <>
          <BuyShippingLabelDialog
            open={showBuyLabelDialog}
            onOpenChange={setShowBuyLabelDialog}
            orderId={orderData.id}
            storeId={orderData.storeId}
            initialAddresses={prefetchedAddresses}
            initialPackages={prefetchedPackages.length > 0 ? prefetchedPackages : undefined}
            onSuccess={() => {
              window.location.reload();
            }}
          />

          <ManualShippingDialog
            open={showManualShippingDialog}
            onOpenChange={setShowManualShippingDialog}
            orderId={orderData.id}
            storeId={orderData.storeId}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        </>
      )}
    </>
  );
}
