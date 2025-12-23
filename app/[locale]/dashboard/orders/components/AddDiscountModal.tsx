"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Search, AlertCircle } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  searchActiveDiscounts,
  evaluateDiscount,
} from "@/app/[locale]/actions/order-discounts";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Discount {
  id: string;
  name: string;
  code: string | null;
  valueType: "fixed" | "percentage";
  value: number;
  currency: string | null;
  minPurchaseAmount: number | null;
  minPurchaseQuantity: number | null;
  appliesTo: string;
}

interface CartItem {
  id: string;
  listingId: string;
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
}

interface AddDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  customerId?: string | null;
  currency: string;
  onApply: (discount: {
    discountId: string | null;
    customDiscount: {
      valueType: "fixed" | "percentage";
      value: number;
      currency?: string | null;
      targets:
        | { type: "all_products" }
        | { type: "listing_ids"; listingIds: string[] };
    } | null;
    result: {
      discountName: string;
      discountCode: string | null;
      valueType: "fixed" | "percentage";
      value: number;
      currency: string | null;
      totalAmount: number;
      allocations: Array<{
        cartItemId: string;
        discountId: string;
        amount: number;
      }>;
    };
  }) => void;
}

export function AddDiscountModal({
  open,
  onOpenChange,
  cartItems,
  customerId,
  currency,
  onApply,
}: AddDiscountModalProps) {
  const [discountType, setDiscountType] = useState<"existing" | "custom">(
    "existing"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(
    null
  );
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  // Custom discount fields
  const [customValueType, setCustomValueType] = useState<
    "percentage" | "fixed"
  >("percentage");
  const [customValue, setCustomValue] = useState("");
  const [customTargetType, setCustomTargetType] = useState<
    "all_products" | "listing_ids"
  >("all_products");
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search discounts
  useEffect(() => {
    if (discountType === "existing" && open) {
      setLoading(true);
      searchActiveDiscounts(debouncedSearch || undefined)
        .then((result) => {
          if (result.success && result.discounts) {
            setDiscounts(result.discounts);
          } else {
            toast.error(result.error || "Failed to search discounts");
          }
        })
        .catch((error) => {
          console.error("Error searching discounts:", error);
          toast.error("Failed to search discounts");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [debouncedSearch, discountType, open]);

  const handleEvaluateDiscount = async (discountId: string | null) => {
    if (cartItems.length === 0) {
      toast.error("Please add items to the cart first");
      return;
    }

    setEvaluating(true);
    setEvaluationError(null);

    try {
      let result;
      if (discountId) {
        result = await evaluateDiscount(
          discountId,
          null,
          cartItems,
          customerId
        );
      } else {
        // Custom discount
        if (!customValue || parseFloat(customValue) <= 0) {
          setEvaluationError("Please enter a valid discount value");
          setEvaluating(false);
          return;
        }

        if (
          customValueType === "percentage" &&
          (parseFloat(customValue) < 1 || parseFloat(customValue) > 100)
        ) {
          setEvaluationError("Percentage must be between 1 and 100");
          setEvaluating(false);
          return;
        }

        result = await evaluateDiscount(
          null,
          {
            valueType: customValueType,
            value: parseFloat(customValue),
            currency: customValueType === "fixed" ? currency : null,
            targets:
              customTargetType === "all_products"
                ? { type: "all_products" }
                : { type: "listing_ids", listingIds: selectedListingIds },
          },
          cartItems,
          customerId
        );
      }

      if (result.success && result.result) {
        onApply({
          discountId,
          customDiscount: discountId
            ? null
            : {
                valueType: customValueType,
                value: parseFloat(customValue),
                currency: customValueType === "fixed" ? currency : null,
                targets:
                  customTargetType === "all_products"
                    ? { type: "all_products" }
                    : { type: "listing_ids", listingIds: selectedListingIds },
              },
          result: result.result,
        });
        onOpenChange(false);
        // Reset form
        setDiscountType("existing");
        setSearchQuery("");
        setSelectedDiscountId(null);
        setCustomValue("");
        setCustomValueType("percentage");
        setCustomTargetType("all_products");
        setSelectedListingIds([]);
        setEvaluationError(null);
      } else {
        setEvaluationError(
          result.validationError || result.error || "Failed to apply discount"
        );
      }
    } catch (error) {
      console.error("Error evaluating discount:", error);
      setEvaluationError("Failed to evaluate discount");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add discount</DialogTitle>
          <DialogDescription>
            Apply an existing discount or create a custom discount for this
            order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Discount Type Selection */}
          <RadioGroup
            value={discountType}
            onValueChange={(v) => {
              setDiscountType(v as "existing" | "custom");
              setSelectedDiscountId(null);
              setEvaluationError(null);
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing">Existing discount</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom">Custom discount</Label>
            </div>
          </RadioGroup>

          <Separator />

          {discountType === "existing" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="search">Search discounts</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading discounts...
                </div>
              ) : discounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No discounts found
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {discounts.map((discount) => (
                    <Card
                      key={discount.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedDiscountId === discount.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedDiscountId(discount.id);
                        setEvaluationError(null);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{discount.name}</h4>
                            {discount.code && (
                              <span className="text-sm text-muted-foreground">
                                ({discount.code})
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {discount.valueType === "percentage"
                              ? `${discount.value}% off`
                              : `${discount.currency || currency} ${discount.value} off`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Applies to: {discount.appliesTo}
                          </p>
                          {(discount.minPurchaseAmount ||
                            discount.minPurchaseQuantity) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Min purchase:{" "}
                              {discount.minPurchaseAmount
                                ? `${discount.currency || currency} ${discount.minPurchaseAmount}`
                                : discount.minPurchaseQuantity
                                  ? `${discount.minPurchaseQuantity} items`
                                  : ""}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEvaluateDiscount(discount.id);
                          }}
                          disabled={evaluating}
                        >
                          Apply
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Discount value</Label>
                <RadioGroup
                  value={customValueType}
                  onValueChange={(v) =>
                    setCustomValueType(v as "percentage" | "fixed")
                  }
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="custom-percentage" />
                    <Label htmlFor="custom-percentage">Percentage</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="custom-fixed" />
                    <Label htmlFor="custom-fixed">Fixed amount</Label>
                  </div>
                </RadioGroup>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={
                      customValueType === "percentage" ? "10" : "5.00"
                    }
                    min={customValueType === "percentage" ? 1 : 0.01}
                    max={customValueType === "percentage" ? 100 : undefined}
                    step={customValueType === "percentage" ? 1 : 0.01}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">
                    {customValueType === "percentage" ? "%" : currency}
                  </span>
                </div>
              </div>

              <div>
                <Label>Applies to</Label>
                <RadioGroup
                  value={customTargetType}
                  onValueChange={(v) =>
                    setCustomTargetType(v as "all_products" | "listing_ids")
                  }
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all_products" id="custom-all" />
                    <Label htmlFor="custom-all">All products</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="listing_ids" id="custom-specific" />
                    <Label htmlFor="custom-specific">Specific products</Label>
                  </div>
                </RadioGroup>
                {customTargetType === "listing_ids" && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Select products from the cart to apply discount
                    </p>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`item-${item.id}`}
                            checked={selectedListingIds.includes(
                              item.listingId
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedListingIds([
                                  ...selectedListingIds,
                                  item.listingId,
                                ]);
                              } else {
                                setSelectedListingIds(
                                  selectedListingIds.filter(
                                    (id) => id !== item.listingId
                                  )
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor={`item-${item.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {item.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleEvaluateDiscount(null)}
                disabled={evaluating || !customValue}
                className="w-full"
              >
                {evaluating ? "Evaluating..." : "Apply discount"}
              </Button>
            </div>
          )}

          {evaluationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{evaluationError}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
