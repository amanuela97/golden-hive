"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import toast from "react-hot-toast";
import {
  createDiscount,
  getProductsForPicker,
  getCustomersForPicker,
} from "../../../../actions/discounts";
import { ProductPickerModal } from "./components/ProductPickerModal";
import { CustomerPickerModal } from "./components/CustomerPickerModal";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { generateUniqueDiscountCode } from "@/lib/discount-code";

interface DiscountFormClientProps {
  userRole?: "admin" | "seller" | "customer";
}

export default function DiscountFormClient({
  userRole = "admin",
}: DiscountFormClientProps) {
  const router = useRouter();
  const isAdmin = userRole === "admin";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [valueType, setValueType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [usageLimitEnabled, setUsageLimitEnabled] = useState(false);
  const [usageLimit, setUsageLimit] = useState("");
  const [minPurchaseType, setMinPurchaseType] = useState<
    "none" | "amount" | "quantity"
  >("none");
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("");
  const [minPurchaseQuantity, setMinPurchaseQuantity] = useState("");
  const [customerEligibilityType, setCustomerEligibilityType] = useState<
    "all" | "specific"
  >("all");
  const [targetType, setTargetType] = useState<"all_products" | "product_ids">(
    "all_products"
  );
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Selected items
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  // Modal states
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Product/Customer data
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; price: string; currency: string }>
  >([]);
  const [customers, setCustomers] = useState<
    Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    }>
  >([]);

  // Load products and customers on mount
  React.useEffect(() => {
    getProductsForPicker().then((result) => {
      if (result.success && result.products) {
        setProducts(result.products);
      }
    });

    getCustomersForPicker().then((result) => {
      if (result.success && result.customers) {
        setCustomers(result.customers);
      }
    });
  }, []);

  // Summary calculations
  const summary = useMemo(() => {
    const valueNum = parseFloat(value) || 0;
    const valueDisplay =
      valueType === "percentage"
        ? `${valueNum}% off`
        : `${valueNum} ${currency} off`;

    const appliesTo =
      targetType === "all_products"
        ? isAdmin
          ? "All marketplace products"
          : "All my products"
        : `${selectedProductIds.length} products`;

    const minRequirement =
      minPurchaseType === "amount"
        ? `€${minPurchaseAmount} purchase`
        : minPurchaseType === "quantity"
          ? `${minPurchaseQuantity} items`
          : "No minimum";

    const eligibility =
      customerEligibilityType === "all"
        ? "All customers"
        : `${selectedCustomerIds.length} customers`;

    let dateRange = "—";
    if (startsAt || endsAt) {
      const start = startsAt
        ? new Date(startsAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;
      const end = endsAt
        ? new Date(endsAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;
      if (start && end) {
        dateRange = `${start} – ${end}`;
      } else if (start) {
        dateRange = `From ${start}`;
      } else if (end) {
        dateRange = `Until ${end}`;
      }
    }

    return {
      valueDisplay,
      appliesTo,
      minRequirement,
      eligibility,
      dateRange,
    };
  }, [
    value,
    valueType,
    currency,
    targetType,
    selectedProductIds.length,
    minPurchaseType,
    minPurchaseAmount,
    minPurchaseQuantity,
    customerEligibilityType,
    selectedCustomerIds.length,
    startsAt,
    endsAt,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!name.trim()) {
        toast.error("Discount name is required");
        setIsSubmitting(false);
        return;
      }

      if (!value || parseFloat(value) <= 0) {
        toast.error("Discount value must be greater than 0");
        setIsSubmitting(false);
        return;
      }

      if (
        valueType === "percentage" &&
        (parseFloat(value) < 1 || parseFloat(value) > 100)
      ) {
        toast.error("Percentage must be between 1 and 100");
        setIsSubmitting(false);
        return;
      }

      if (targetType === "product_ids" && selectedProductIds.length === 0) {
        toast.error("At least one product must be selected");
        setIsSubmitting(false);
        return;
      }

      if (
        customerEligibilityType === "specific" &&
        selectedCustomerIds.length === 0
      ) {
        toast.error("At least one customer must be selected");
        setIsSubmitting(false);
        return;
      }

      if (
        minPurchaseType === "amount" &&
        minPurchaseAmount &&
        parseFloat(minPurchaseAmount) <= 0
      ) {
        toast.error("Minimum purchase amount must be greater than 0");
        setIsSubmitting(false);
        return;
      }

      if (
        minPurchaseType === "quantity" &&
        minPurchaseQuantity &&
        parseInt(minPurchaseQuantity) <= 0
      ) {
        toast.error("Minimum purchase quantity must be greater than 0");
        setIsSubmitting(false);
        return;
      }

      const discountData = {
        name: name.trim(),
        code: code.trim() || null,
        type: "amount_off_products" as const,
        valueType,
        value: parseFloat(value),
        currency: valueType === "fixed" ? currency : null,
        usageLimit:
          usageLimitEnabled && usageLimit ? parseInt(usageLimit) : null,
        minPurchaseAmount:
          minPurchaseType === "amount" && minPurchaseAmount
            ? parseFloat(minPurchaseAmount)
            : null,
        minPurchaseQuantity:
          minPurchaseType === "quantity" && minPurchaseQuantity
            ? parseInt(minPurchaseQuantity)
            : null,
        customerEligibilityType,
        customerIds:
          customerEligibilityType === "specific"
            ? selectedCustomerIds
            : undefined,
        targetType,
        productIds:
          targetType === "product_ids" ? selectedProductIds : undefined,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: true,
      };

      const result = await createDiscount(discountData);

      if (result.success) {
        toast.success("Discount created successfully");
        router.push("/dashboard/discounts");
      } else {
        toast.error(result.error || "Failed to create discount");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-6">
        <Link
          href="/dashboard/discounts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Discounts
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Discount Details */}
          <Card>
            <CardHeader>
              <CardTitle>Discount Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">
                  Discount name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Summer Sale"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="code">Discount code (optional)</Label>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsGeneratingCode(true);
                      try {
                        // Check if code exists in database
                        const checkCodeExists = async (codeToCheck: string) => {
                          const response = await fetch(
                            `/api/discounts/check-code?code=${encodeURIComponent(codeToCheck)}`
                          );
                          if (!response.ok) return false;
                          const data = await response.json();
                          return data.exists === true;
                        };

                        const uniqueCode =
                          await generateUniqueDiscountCode(checkCodeExists);
                        setCode(uniqueCode);
                      } catch (error) {
                        toast.error(
                          "Failed to generate unique code. Please try again."
                        );
                        console.error("Error generating code:", error);
                      } finally {
                        setIsGeneratingCode(false);
                      }
                    }}
                    disabled={isGeneratingCode}
                    className="text-sm text-yellow-600 hover:text-yellow-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingCode
                      ? "Generating..."
                      : "Generate random code"}
                  </button>
                </div>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SUMMER10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Discount Value */}
          <Card>
            <CardHeader>
              <CardTitle>Discount Value</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={valueType}
                onValueChange={(v) => setValueType(v as "percentage" | "fixed")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage">Percentage</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed">Fixed amount</Label>
                </div>
              </RadioGroup>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={valueType === "percentage" ? "10" : "5.00"}
                  min={valueType === "percentage" ? 1 : 0.01}
                  max={valueType === "percentage" ? 100 : undefined}
                  step={valueType === "percentage" ? 1 : 0.01}
                  required
                  className="flex-1"
                />
                <span className="text-muted-foreground">
                  {valueType === "percentage" ? "%" : currency}
                </span>
              </div>

              {valueType === "fixed" && (
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="NPR">NPR</option>
                  </select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Applies To */}
          <Card>
            <CardHeader>
              <CardTitle>Applies To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={targetType}
                onValueChange={(v) =>
                  setTargetType(v as "all_products" | "product_ids")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_products" id="all_products" />
                  <Label htmlFor="all_products">
                    {isAdmin ? "All marketplace products" : "All my products"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="product_ids" id="product_ids" />
                  <Label htmlFor="product_ids">Specific products</Label>
                </div>
              </RadioGroup>

              {targetType === "product_ids" && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowProductPicker(true)}
                  >
                    Select products
                  </Button>
                  {selectedProductIds.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Applies to: {selectedProductIds.length} products
                      <Button
                        type="button"
                        variant="link"
                        className="ml-2 h-auto p-0"
                        onClick={() => setShowProductPicker(true)}
                      >
                        View selected products
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Minimum Purchase Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Minimum Purchase Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={minPurchaseType}
                onValueChange={(v) =>
                  setMinPurchaseType(v as "none" | "amount" | "quantity")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="min_none" />
                  <Label htmlFor="min_none">No minimum requirements</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="amount" id="min_amount" />
                  <Label htmlFor="min_amount">Minimum purchase amount</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quantity" id="min_quantity" />
                  <Label htmlFor="min_quantity">
                    Minimum quantity of items
                  </Label>
                </div>
              </RadioGroup>

              {minPurchaseType === "amount" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={minPurchaseAmount}
                    onChange={(e) => setMinPurchaseAmount(e.target.value)}
                    placeholder="50.00"
                    min="0.01"
                    step="0.01"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">{currency}</span>
                </div>
              )}

              {minPurchaseType === "quantity" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={minPurchaseQuantity}
                    onChange={(e) => setMinPurchaseQuantity(e.target.value)}
                    placeholder="3"
                    min="1"
                    step="1"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">items</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Customer Eligibility */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={customerEligibilityType}
                onValueChange={(v) =>
                  setCustomerEligibilityType(v as "all" | "specific")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="eligibility_all" />
                  <Label htmlFor="eligibility_all">All customers</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="eligibility_specific" />
                  <Label htmlFor="eligibility_specific">
                    Specific customers
                  </Label>
                </div>
              </RadioGroup>

              {customerEligibilityType === "specific" && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCustomerPicker(true)}
                  >
                    Select customers
                  </Button>
                  {selectedCustomerIds.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Eligible customers: {selectedCustomerIds.length}
                      <Button
                        type="button"
                        variant="link"
                        className="ml-2 h-auto p-0"
                        onClick={() => setShowCustomerPicker(true)}
                      >
                        View customers
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Active Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Active Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="startsAt">Start date (optional)</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="endsAt">End date (optional)</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 7: Usage Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="usageLimit"
                  checked={usageLimitEnabled}
                  onCheckedChange={(checked) =>
                    setUsageLimitEnabled(checked === true)
                  }
                />
                <Label htmlFor="usageLimit">
                  Limit number of times this discount can be used
                </Label>
              </div>

              {usageLimitEnabled && (
                <div>
                  <Input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder="100"
                    min="1"
                    step="1"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="flex justify-end gap-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/discounts")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save discount"}
            </Button>
          </div>
        </form>
      </div>

      {/* Summary Sidebar */}
      <div className="w-80">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Type
              </div>
              <div className="text-sm">Amount off products</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Value
              </div>
              <div className="text-sm">{summary.valueDisplay}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Applies to
              </div>
              <div className="text-sm">{summary.appliesTo}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Minimum
              </div>
              <div className="text-sm">{summary.minRequirement}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Eligibility
              </div>
              <div className="text-sm">{summary.eligibility}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Dates
              </div>
              <div className="text-sm">{summary.dateRange}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ProductPickerModal
        open={showProductPicker}
        onOpenChange={setShowProductPicker}
        products={products}
        selectedProductIds={selectedProductIds}
        onSelect={(ids) => setSelectedProductIds(ids)}
      />

      <CustomerPickerModal
        open={showCustomerPicker}
        onOpenChange={setShowCustomerPicker}
        customers={customers}
        selectedCustomerIds={selectedCustomerIds}
        onSelect={(ids) => setSelectedCustomerIds(ids)}
      />
    </div>
  );
}
