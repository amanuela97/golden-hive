"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { processRefund } from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import { ArrowLeft, AlertCircle, Minus, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
interface OrderWithItems {
  id: string;
  orderNumber: number;
  totalAmount: string;
  refundedAmount: string | null;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  status: string;
  archivedAt: Date | null;
  paymentProvider: string | null; // 'stripe' | 'manual' | null
  items: Array<{
    id: string;
    title: string;
    sku: string | null;
    quantity: number;
    unitPrice: string;
    lineSubtotal: string;
    lineTotal: string;
    currency: string;
    imageUrl: string | null;
    refundableQuantity: number; // Remaining quantity that can be refunded
  }>;
}

interface RefundPageClientProps {
  orderData: OrderWithItems;
}

export default function RefundPageClient({ orderData }: RefundPageClientProps) {
  const router = useRouter();
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [restockItems, setRestockItems] = useState(
    orderData.fulfillmentStatus === "unfulfilled"
  );
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Initialize quantities to 0 for all items
  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    orderData.items.forEach((item) => {
      initialQuantities[item.id] = 0;
    });
    setItemQuantities(initialQuantities);
  }, [orderData.items]);

  const totalPaid = parseFloat(orderData.totalAmount);
  const alreadyRefunded = parseFloat(orderData.refundedAmount || "0");
  const maxRefundable = totalPaid - alreadyRefunded;

  // Calculate refund amount based on selected quantities
  // Use proportional amount from lineTotal to account for discounts/taxes
  const calculateRefundAmount = (): number => {
    let total = 0;
    orderData.items.forEach((item) => {
      const quantity = itemQuantities[item.id] || 0;
      if (quantity > 0) {
        // Calculate proportional refund: (lineTotal / originalQuantity) * refundQuantity
        // This ensures discounts/taxes are properly accounted for
        const lineTotal = parseFloat(item.lineTotal);
        const originalQuantity = item.quantity;
        const proportionalAmount = (lineTotal / originalQuantity) * quantity;
        console.log(`[Refund Client] Calculating refund for item:`, {
          itemId: item.id,
          title: item.title,
          lineTotal,
          originalQuantity,
          refundQuantity: quantity,
          proportionalAmount,
        });
        total += proportionalAmount;
      }
    });
    console.log(`[Refund Client] Total refund amount:`, total);
    return total;
  };

  const refundAmount = calculateRefundAmount();
  const isFullRefund = refundAmount >= maxRefundable - 0.01; // Allow small floating point differences
  const refundType: "full" | "partial" = isFullRefund ? "full" : "partial";

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const item = orderData.items.find((i) => i.id === itemId);
    if (!item) return;

    // Clamp between 0 and refundable quantity (not original quantity)
    const clampedQuantity = Math.max(
      0,
      Math.min(newQuantity, item.refundableQuantity)
    );
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: clampedQuantity,
    }));
  };

  const handleIncrement = (itemId: string) => {
    const item = orderData.items.find((i) => i.id === itemId);
    if (!item) return;
    const current = itemQuantities[itemId] || 0;
    // Don't increment beyond refundable quantity
    if (current < item.refundableQuantity) {
      handleQuantityChange(itemId, current + 1);
    }
  };

  const handleDecrement = (itemId: string) => {
    const current = itemQuantities[itemId] || 0;
    handleQuantityChange(itemId, current - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (refundAmount <= 0) {
      toast.error("Please select at least one item to refund");
      return;
    }

    if (refundAmount > maxRefundable) {
      toast.error(
        `Refund amount cannot exceed ${maxRefundable.toFixed(2)} ${orderData.currency}`
      );
      return;
    }

    setProcessing(true);
    try {
      // Use custom reason if "other" is selected, otherwise use the selected reason
      const finalReason = reason === "other" ? customReason.trim() : reason;

      // Build refundedItems array from selected quantities
      const refundedItems = orderData.items
        .filter((item) => {
          const qty = itemQuantities[item.id] || 0;
          return qty > 0;
        })
        .map((item) => ({
          orderItemId: item.id,
          quantity: itemQuantities[item.id] || 0,
        }));

      const result = await processRefund({
        orderId: orderData.id,
        refundType,
        amount: refundAmount.toString(), // Always pass the calculated amount from selected items
        restockItems,
        reason: finalReason || undefined,
        refundedItems: refundedItems.length > 0 ? refundedItems : undefined,
      });

      if (result.success) {
        toast.success("Refund processed successfully");
        // Use setTimeout to ensure toast is visible before redirect
        setTimeout(() => {
          router.push("/dashboard/orders");
          router.refresh();
        }, 500);
      } else {
        toast.error(result.error || "Failed to process refund");
        setProcessing(false); // Re-enable button on error
      }
    } catch (error) {
      toast.error("An error occurred while processing the refund");
      console.error("Refund error:", error);
    } finally {
      setProcessing(false);
    }
  };

  const hasSelectedItems = Object.values(itemQuantities).some((qty) => qty > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/orders/${orderData.id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Order
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              Refund Order #{orderData.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select items and quantities to refund
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Method Info */}
        {orderData.paymentProvider && (
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Original Payment Method:
              </span>
              <span className="font-medium capitalize">
                {orderData.paymentProvider === "stripe" ? "Stripe" : "Manual"}
              </span>
              {orderData.paymentProvider === "stripe" && (
                <span className="text-xs text-muted-foreground">
                  (Refund will be processed via Stripe)
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Order Items */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Select Items to Refund</h2>
          <div className="space-y-4">
            {orderData.items
              .filter((item) => item.refundableQuantity > 0) // Only show items that can still be refunded
              .map((item) => {
                const quantity = itemQuantities[item.id] || 0;
                // Calculate proportional refund amount to account for discounts/taxes
                const lineTotal = parseFloat(item.lineTotal);
                const originalQuantity = item.quantity;
                const effectiveUnitPrice = lineTotal / originalQuantity;
                const lineRefundAmount = effectiveUnitPrice * quantity;
                const maxQuantity = item.refundableQuantity; // Use refundable quantity, not original quantity

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {item.imageUrl ? (
                        <div className="relative h-20 w-20 overflow-hidden rounded-md border">
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-md border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            No image
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.title}</h3>
                      {item.sku && (
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {orderData.currency}{" "}
                        {(parseFloat(item.lineTotal) / item.quantity).toFixed(
                          2
                        )}{" "}
                        each
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`quantity-${item.id}`}
                        className="text-sm"
                      >
                        Quantity:
                      </Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDecrement(item.id)}
                          disabled={quantity === 0 || processing}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id={`quantity-${item.id}`}
                          type="number"
                          min="0"
                          max={maxQuantity}
                          value={quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 0;
                            handleQuantityChange(item.id, newQty);
                          }}
                          className="w-20 text-center"
                          disabled={processing}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleIncrement(item.id)}
                          disabled={quantity >= maxQuantity || processing}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        / {maxQuantity}{" "}
                        {item.quantity !== item.refundableQuantity &&
                          `(of ${item.quantity} total)`}
                      </span>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-[100px]">
                      {quantity > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Refund Amount:
                          </p>
                          <p className="font-medium">
                            {orderData.currency} {lineRefundAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* Refund Summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Refund Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Paid:</span>
              <span className="font-medium">
                {totalPaid.toFixed(2)} {orderData.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Already Refunded:</span>
              <span className="font-medium">
                {alreadyRefunded.toFixed(2)} {orderData.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>This Refund:</span>
              <span className="font-medium">
                {refundAmount.toFixed(2)} {orderData.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Remaining After Refund:</span>
              <span>
                {(totalPaid - alreadyRefunded - refundAmount).toFixed(2)}{" "}
                {orderData.currency}
              </span>
            </div>
          </div>
        </Card>

        {/* Restock Items */}
        <Card className="p-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="restockItems"
              checked={restockItems}
              onCheckedChange={(checked) => setRestockItems(checked === true)}
              disabled={processing}
            />
            <Label
              htmlFor="restockItems"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Restock items to inventory
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-6">
            {orderData.fulfillmentStatus === "unfulfilled"
              ? "Recommended: Items will be returned to inventory"
              : "Items have been fulfilled. Only restock if items are returned."}
          </p>
        </Card>

        {/* Reason */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Select
                value={reason}
                onValueChange={(value) => {
                  setReason(value);
                  // Clear custom reason when switching away from "other"
                  if (value !== "other") {
                    setCustomReason("");
                  }
                }}
                disabled={processing}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_request">
                    Customer Request
                  </SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="fraud">Fraud</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom reason input - shown when "other" is selected */}
            {reason === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Please specify the reason</Label>
                <Textarea
                  id="customReason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter the refund reason..."
                  rows={3}
                  disabled={processing}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Warning */}
        {hasSelectedItems && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {refundType === "full" ? "Full Refund" : "Partial Refund"}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                This will refund {refundAmount.toFixed(2)} {orderData.currency}{" "}
                to the customer
                {refundType === "full"
                  ? " (full amount)."
                  : ` (${((refundAmount / maxRefundable) * 100).toFixed(1)}% of refundable amount).`}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/orders/${orderData.id}`)}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={processing || !hasSelectedItems}>
            {processing ? "Processing..." : "Process Refund"}
          </Button>
        </div>
      </form>
    </div>
  );
}
