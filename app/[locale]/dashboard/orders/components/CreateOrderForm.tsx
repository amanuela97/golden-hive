"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Minus,
} from "lucide-react";
import {
  createOrder,
  searchProductsForOrder,
  getOrCreateCustomerForUser,
  type LineItemInput,
} from "@/app/[locale]/actions/orders";
import toast from "react-hot-toast";
import Image from "next/image";

type LineItem = LineItemInput & {
  id: string;
  listingName: string;
  variantTitle: string;
  imageUrl?: string | null;
  variantImageUrl?: string | null;
  currency: string;
};

type ProductVariant = {
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  variantId: string;
  variantTitle: string;
  variantImageUrl: string | null;
  sku: string | null;
  price: string | null;
  currency: string;
  available: number;
};

type GroupedProduct = {
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  variants: ProductVariant[];
  // Computed: first variant image as fallback
  displayImageUrl: string | null;
};

export default function CreateOrderForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Customer source selector
  const [customerSource, setCustomerSource] = useState<"myInfo" | "manual">(
    "myInfo"
  );

  // Customer info
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Summary
  const [currency, setCurrency] = useState("NPR");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");

  // Statuses
  const [orderStatus, setOrderStatus] = useState<"open" | "draft">("open");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">(
    "pending"
  );
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<"unfulfilled">("unfulfilled");

  // Addresses
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingRegion, setShippingRegion] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");

  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddressLine1, setBillingAddressLine1] = useState("");
  const [billingAddressLine2, setBillingAddressLine2] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingRegion, setBillingRegion] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Auto-fill customer info on mount or when source changes
  useEffect(() => {
    const loadCustomerInfo = async () => {
      if (customerSource === "myInfo") {
        setLoadingCustomer(true);
        try {
          const result = await getOrCreateCustomerForUser();
          if (result.success && result.data) {
            const data = result.data;
            setCustomerEmail(data.email);
            setCustomerFirstName(data.firstName || "");
            setCustomerLastName(data.lastName || "");
            setCustomerPhone(data.phone || "");

            // Auto-fill shipping address
            if (data.shippingFirstName || data.shippingLastName) {
              setShippingName(
                `${data.shippingFirstName || ""} ${data.shippingLastName || ""}`.trim()
              );
            }
            setShippingAddressLine1(data.shippingAddress || "");
            setShippingAddressLine2(data.shippingAddress2 || "");
            setShippingCity(data.shippingCity || "");
            setShippingRegion(data.shippingState || "");
            setShippingPostalCode(data.shippingZip || "");
            setShippingCountry(data.shippingCountry || "");

            // Auto-fill billing address
            if (data.billingFirstName || data.billingLastName) {
              setBillingName(
                `${data.billingFirstName || ""} ${data.billingLastName || ""}`.trim()
              );
            }
            setBillingAddressLine1(data.billingAddress || "");
            setBillingAddressLine2(data.billingAddress2 || "");
            setBillingCity(data.billingCity || "");
            setBillingRegion(data.billingState || "");
            setBillingPostalCode(data.billingZip || "");
            setBillingCountry(data.billingCountry || "");
          } else {
            // If no customer found, clear fields
            setCustomerEmail("");
            setCustomerFirstName("");
            setCustomerLastName("");
            setCustomerPhone("");
          }
        } catch (error) {
          console.error("Failed to load customer info:", error);
        } finally {
          setLoadingCustomer(false);
        }
      } else {
        // Manual entry - clear all fields
        setCustomerEmail("");
        setCustomerFirstName("");
        setCustomerLastName("");
        setCustomerPhone("");
        setShippingName("");
        setShippingPhone("");
        setShippingAddressLine1("");
        setShippingAddressLine2("");
        setShippingCity("");
        setShippingRegion("");
        setShippingPostalCode("");
        setShippingCountry("");
        setBillingName("");
        setBillingPhone("");
        setBillingAddressLine1("");
        setBillingAddressLine2("");
        setBillingCity("");
        setBillingRegion("");
        setBillingPostalCode("");
        setBillingCountry("");
      }
    };

    loadCustomerInfo();
  }, [customerSource]);

  // Product picker modal
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchBy, setSearchBy] = useState<
    | "all"
    | "product_title"
    | "product_id"
    | "sku"
    | "variant_title"
    | "variant_id"
  >("all");
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
    new Set()
  );
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  );
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const prevDebouncedSearchRef = useRef<string>("");
  const prevSearchByRef = useRef<typeof searchBy>("all");

  // Debounce search input
  const debouncedSearch = useDebounce(productSearch, 500);

  // Get already added variant IDs
  const addedVariantIds = useMemo(() => {
    return new Set(lineItems.map((item) => item.variantId || ""));
  }, [lineItems]);

  // Calculate totals
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      return sum + parseFloat(item.unitPrice) * item.quantity;
    }, 0);
  }, [lineItems]);

  const total = useMemo(() => {
    return (
      subtotal -
      parseFloat(discountAmount || "0") +
      parseFloat(shippingAmount || "0") +
      parseFloat(taxAmount || "0")
    );
  }, [subtotal, discountAmount, shippingAmount, taxAmount]);

  // Search products function
  const performSearch = useCallback(
    async (
      searchTerm: string | undefined,
      searchType: typeof searchBy,
      page: number = 1
    ): Promise<void> => {
      setSearching(true);
      try {
        const result = await searchProductsForOrder(
          searchTerm?.trim() || undefined,
          searchType,
          page,
          pageSize
        );
        if (result.success && result.data) {
          // Group products by listing
          const grouped = result.data.reduce((acc, variant) => {
            const existing = acc.find((p) => p.listingId === variant.listingId);
            // Ensure currency is not null
            const variantWithCurrency: ProductVariant = {
              ...variant,
              currency: variant.currency || "NPR",
            };
            if (existing) {
              existing.variants.push(variantWithCurrency);
            } else {
              // Use listing image, or first variant image as fallback
              const displayImageUrl =
                variant.listingImageUrl || variant.variantImageUrl || null;
              acc.push({
                listingId: variant.listingId,
                listingName: variant.listingName,
                listingImageUrl: variant.listingImageUrl,
                variants: [variantWithCurrency],
                displayImageUrl,
              });
            }
            return acc;
          }, [] as GroupedProduct[]);

          // Update displayImageUrl for existing groups if listing image is null
          grouped.forEach((product) => {
            if (!product.displayImageUrl) {
              // Find first variant with an image
              const variantWithImage = product.variants.find(
                (v) => v.variantImageUrl
              );
              if (variantWithImage) {
                product.displayImageUrl = variantWithImage.variantImageUrl;
              }
            }
          });

          setGroupedProducts(grouped);
          setTotalCount(result.totalCount || 0);
          setCurrentPage(result.page || 1);
          // Auto-expand all products
          setExpandedProducts(new Set(grouped.map((p) => p.listingId)));
        } else {
          if (result.error) {
            console.error("Search error:", result.error);
          }
          setGroupedProducts([]);
          setTotalCount(0);
          setCurrentPage(1);
        }
      } catch (error) {
        console.error("Failed to search products:", error);
        setGroupedProducts([]);
        setTotalCount(0);
        setCurrentPage(1);
      } finally {
        setSearching(false);
      }
    },
    [pageSize]
  );

  // Load all products on modal open
  useEffect(() => {
    if (productPickerOpen) {
      // Reset search when modal opens
      setProductSearch("");
      setCurrentPage(1);
      prevDebouncedSearchRef.current = "";
      prevSearchByRef.current = "all";
      // Load first page of products immediately when modal opens
      performSearch(undefined, "all", 1);
    } else {
      // Reset when modal closes
      setProductSearch("");
      setGroupedProducts([]);
      setSelectedVariants(new Set());
      setExpandedProducts(new Set());
      setCurrentPage(1);
      setTotalCount(0);
      prevDebouncedSearchRef.current = "";
      prevSearchByRef.current = "all";
    }
  }, [productPickerOpen, performSearch]);

  // Auto-search when debounced search or searchBy changes (only if they actually changed)
  useEffect(() => {
    if (productPickerOpen) {
      const searchTerm = debouncedSearch.trim() || undefined;
      const prevSearchTerm = prevDebouncedSearchRef.current.trim() || undefined;
      const searchChanged = searchTerm !== prevSearchTerm;
      const searchByChanged = searchBy !== prevSearchByRef.current;

      // Only search if something actually changed (avoid duplicate search on initial load)
      if (searchChanged || searchByChanged) {
        setCurrentPage(1); // Reset to first page when search changes
        performSearch(searchTerm, searchBy, 1);
        prevDebouncedSearchRef.current = debouncedSearch;
        prevSearchByRef.current = searchBy;
      }
    }
  }, [debouncedSearch, searchBy, productPickerOpen, performSearch]);

  // Toggle product expansion
  const toggleProductExpansion = (listingId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(listingId)) {
        newSet.delete(listingId);
      } else {
        newSet.add(listingId);
      }
      return newSet;
    });
  };

  // Toggle variant selection
  const toggleVariantSelection = (variantId: string) => {
    if (addedVariantIds.has(variantId)) {
      return; // Don't allow selecting already added variants
    }
    setSelectedVariants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(variantId)) {
        newSet.delete(variantId);
      } else {
        newSet.add(variantId);
      }
      return newSet;
    });
  };

  // Add selected products to line items
  const handleAddSelectedProducts = () => {
    const variantsToAdd: ProductVariant[] = [];

    groupedProducts.forEach((product) => {
      product.variants.forEach((variant) => {
        if (selectedVariants.has(variant.variantId)) {
          variantsToAdd.push(variant);
        }
      });
    });

    if (variantsToAdd.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    variantsToAdd.forEach((variant) => {
      const existingItem = lineItems.find(
        (item) => item.variantId === variant.variantId
      );

      if (!existingItem) {
        // Use variant image if available, otherwise use listing image
        const displayImageUrl =
          variant.variantImageUrl || variant.listingImageUrl || null;
        const newItem: LineItem = {
          id: `${Date.now()}-${Math.random()}`,
          listingId: variant.listingId,
          variantId: variant.variantId,
          quantity: 1,
          unitPrice: variant.price || "0",
          title: `${variant.listingName} - ${variant.variantTitle}`,
          sku: variant.sku || null,
          listingName: variant.listingName,
          variantTitle: variant.variantTitle,
          imageUrl: displayImageUrl,
          variantImageUrl: variant.variantImageUrl,
          currency: variant.currency,
        };
        setLineItems((prev) => [...prev, newItem]);
      }
    });

    setProductPickerOpen(false);
    setSelectedVariants(new Set());
    toast.success(`Added ${variantsToAdd.length} item(s)`);
  };

  // Remove line item
  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update line item quantity
  const handleUpdateQuantity = (id: string, delta: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const handleSetQuantity = (id: string, value: string) => {
    const numValue = parseInt(value) || 1;
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, numValue) } : item
      )
    );
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    if (!customerEmail.trim()) {
      toast.error("Please enter customer email");
      return;
    }

    setLoading(true);
    try {
      const result = await createOrder({
        customerEmail: customerEmail.trim(),
        customerFirstName: customerFirstName.trim() || null,
        customerLastName: customerLastName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        lineItems: lineItems.map((item) => ({
          listingId: item.listingId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          title: item.title,
          sku: item.sku || null,
        })),
        currency,
        subtotalAmount: subtotal.toFixed(2),
        discountAmount: discountAmount || "0",
        shippingAmount: shippingAmount || "0",
        taxAmount: taxAmount || "0",
        totalAmount: total.toFixed(2),
        paymentStatus,
        fulfillmentStatus,
        status: orderStatus,
        shippingName: shippingName.trim() || null,
        shippingPhone: shippingPhone.trim() || null,
        shippingAddressLine1: shippingAddressLine1.trim() || null,
        shippingAddressLine2: shippingAddressLine2.trim() || null,
        shippingCity: shippingCity.trim() || null,
        shippingRegion: shippingRegion.trim() || null,
        shippingPostalCode: shippingPostalCode.trim() || null,
        shippingCountry: shippingCountry.trim() || null,
        billingName: billingSameAsShipping
          ? shippingName.trim() || null
          : billingName.trim() || null,
        billingPhone: billingSameAsShipping
          ? shippingPhone.trim() || null
          : billingPhone.trim() || null,
        billingAddressLine1: billingSameAsShipping
          ? shippingAddressLine1.trim() || null
          : billingAddressLine1.trim() || null,
        billingAddressLine2: billingSameAsShipping
          ? shippingAddressLine2.trim() || null
          : billingAddressLine2.trim() || null,
        billingCity: billingSameAsShipping
          ? shippingCity.trim() || null
          : billingCity.trim() || null,
        billingRegion: billingSameAsShipping
          ? shippingRegion.trim() || null
          : billingRegion.trim() || null,
        billingPostalCode: billingSameAsShipping
          ? shippingPostalCode.trim() || null
          : billingPostalCode.trim() || null,
        billingCountry: billingSameAsShipping
          ? shippingCountry.trim() || null
          : billingCountry.trim() || null,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast.success("Order created successfully");
        router.push("/dashboard/orders");
      } else {
        toast.error(result.error || "Failed to create order");
      }
    } catch {
      toast.error("Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Create Order</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/orders")}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Section */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Customer</h2>

              {/* Customer Source Selector */}
              <div className="mb-6 space-y-3">
                <Label>Customer Source</Label>
                <div className="flex gap-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customerSource"
                      value="myInfo"
                      checked={customerSource === "myInfo"}
                      onChange={(e) =>
                        setCustomerSource(e.target.value as "myInfo" | "manual")
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Use my saved customer info</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customerSource"
                      value="manual"
                      checked={customerSource === "manual"}
                      onChange={(e) =>
                        setCustomerSource(e.target.value as "myInfo" | "manual")
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      Enter customer info manually
                    </span>
                  </label>
                </div>
                {loadingCustomer && (
                  <p className="text-sm text-muted-foreground">
                    Loading customer info...
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerEmail">Email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    disabled={loadingCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customerFirstName">First Name</Label>
                  <Input
                    id="customerFirstName"
                    value={customerFirstName}
                    onChange={(e) => setCustomerFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customerLastName">Last Name</Label>
                  <Input
                    id="customerLastName"
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Line Items Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Line Items</h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductPickerOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click &quot;Add Product&quot; to get
                  started.
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((item) => {
                    const itemTotal =
                      parseFloat(item.unitPrice) * item.quantity;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.title}
                              width={60}
                              height={60}
                              className="rounded object-cover"
                            />
                          ) : (
                            <div className="w-[60px] h-[60px] bg-muted rounded flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">
                                No image
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {item.variantTitle}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.currency}{" "}
                            {parseFloat(item.unitPrice).toFixed(2)}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(item.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleSetQuantity(item.id, e.target.value)
                            }
                            className="w-16 text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(item.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Total */}
                        <div className="text-sm font-medium w-24 text-right">
                          {item.currency} {itemTotal.toFixed(2)}
                        </div>

                        {/* Remove Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Notes */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Notes</h2>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this order..."
                rows={4}
              />
            </Card>
          </div>

          {/* Right Column - Summary, Status, Addresses */}
          <div className="space-y-6">
            {/* Summary */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Summary</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NPR">NPR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>
                      {currency} {subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <Label htmlFor="discount">Discount</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping">Shipping</Label>
                    <Input
                      id="shipping"
                      type="number"
                      step="0.01"
                      min="0"
                      value={shippingAmount}
                      onChange={(e) => setShippingAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax">Tax</Label>
                    <Input
                      id="tax"
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>
                      {currency} {total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Statuses */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Status</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orderStatus">Order Status</Label>
                  <Select
                    value={orderStatus}
                    onValueChange={(value: "open" | "draft") =>
                      setOrderStatus(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(value: "pending" | "paid") =>
                      setPaymentStatus(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fulfillmentStatus">Fulfillment Status</Label>
                  <Select
                    value={fulfillmentStatus}
                    onValueChange={(value: "unfulfilled") =>
                      setFulfillmentStatus(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Shipping Address */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="shippingName">Name</Label>
                  <Input
                    id="shippingName"
                    value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="shippingPhone">Phone</Label>
                  <Input
                    id="shippingPhone"
                    value={shippingPhone}
                    onChange={(e) => setShippingPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="shippingAddressLine1">Address Line 1</Label>
                  <Input
                    id="shippingAddressLine1"
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="shippingAddressLine2">Address Line 2</Label>
                  <Input
                    id="shippingAddressLine2"
                    value={shippingAddressLine2}
                    onChange={(e) => setShippingAddressLine2(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shippingCity">City</Label>
                    <Input
                      id="shippingCity"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingRegion">Region</Label>
                    <Input
                      id="shippingRegion"
                      value={shippingRegion}
                      onChange={(e) => setShippingRegion(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shippingPostalCode">Postal Code</Label>
                    <Input
                      id="shippingPostalCode"
                      value={shippingPostalCode}
                      onChange={(e) => setShippingPostalCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingCountry">Country</Label>
                    <CountrySelect
                      id="shippingCountry"
                      value={shippingCountry}
                      onValueChange={setShippingCountry}
                      placeholder="Select a country"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Billing Address */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Billing Address</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="billingSameAsShipping"
                    checked={billingSameAsShipping}
                    onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="billingSameAsShipping" className="text-sm">
                    Same as shipping
                  </Label>
                </div>
              </div>
              {!billingSameAsShipping && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="billingName">Name</Label>
                    <Input
                      id="billingName"
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="billingPhone">Phone</Label>
                    <Input
                      id="billingPhone"
                      value={billingPhone}
                      onChange={(e) => setBillingPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="billingAddressLine1">Address Line 1</Label>
                    <Input
                      id="billingAddressLine1"
                      value={billingAddressLine1}
                      onChange={(e) => setBillingAddressLine1(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="billingAddressLine2">Address Line 2</Label>
                    <Input
                      id="billingAddressLine2"
                      value={billingAddressLine2}
                      onChange={(e) => setBillingAddressLine2(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="billingCity">City</Label>
                      <Input
                        id="billingCity"
                        value={billingCity}
                        onChange={(e) => setBillingCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingRegion">Region</Label>
                      <Input
                        id="billingRegion"
                        value={billingRegion}
                        onChange={(e) => setBillingRegion(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="billingPostalCode">Postal Code</Label>
                      <Input
                        id="billingPostalCode"
                        value={billingPostalCode}
                        onChange={(e) => setBillingPostalCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingCountry">Country</Label>
                      <CountrySelect
                        id="billingCountry"
                        value={billingCountry}
                        onValueChange={setBillingCountry}
                        placeholder="Select a country"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/orders")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </form>

      {/* Product Picker Modal */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={searchBy}
                onValueChange={(value: typeof searchBy) => setSearchBy(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="product_title">Product Title</SelectItem>
                  <SelectItem value="product_id">Product ID</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="variant_title">Variant Title</SelectItem>
                  <SelectItem value="variant_id">Variant ID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              {searching ? (
                <div className="p-8 text-center text-muted-foreground">
                  Searching...
                </div>
              ) : groupedProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {productSearch.trim()
                    ? "No products found. Try a different search term."
                    : "No products found."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedProducts.map((product) => {
                      const isExpanded = expandedProducts.has(
                        product.listingId
                      );
                      const allVariantsSelected = product.variants.every(
                        (v) =>
                          selectedVariants.has(v.variantId) ||
                          addedVariantIds.has(v.variantId)
                      );

                      return (
                        <React.Fragment key={product.listingId}>
                          {/* Product Row */}
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              toggleProductExpansion(product.listingId)
                            }
                          >
                            <TableCell className="w-12">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <Checkbox
                                  checked={allVariantsSelected}
                                  onCheckedChange={(checked) => {
                                    product.variants.forEach((variant) => {
                                      if (
                                        !addedVariantIds.has(variant.variantId)
                                      ) {
                                        if (checked) {
                                          setSelectedVariants((prev) =>
                                            new Set(prev).add(variant.variantId)
                                          );
                                        } else {
                                          setSelectedVariants((prev) => {
                                            const newSet = new Set(prev);
                                            newSet.delete(variant.variantId);
                                            return newSet;
                                          });
                                        }
                                      }
                                    });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="pointer-events-auto"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {product.displayImageUrl && (
                                  <Image
                                    src={product.displayImageUrl}
                                    alt={product.listingName}
                                    width={40}
                                    height={40}
                                    className="rounded object-cover"
                                  />
                                )}
                                <span className="font-medium">
                                  {product.listingName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {product.variants.reduce(
                                (sum, v) => sum + v.available,
                                0
                              )}
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                          </TableRow>

                          {/* Variant Rows */}
                          {isExpanded &&
                            product.variants.map((variant) => {
                              const isSelected = selectedVariants.has(
                                variant.variantId
                              );
                              const isAdded = addedVariantIds.has(
                                variant.variantId
                              );
                              const isDisabled = isAdded;

                              return (
                                <TableRow
                                  key={variant.variantId}
                                  className={`cursor-pointer hover:bg-muted/50 ${
                                    isDisabled ? "opacity-50" : ""
                                  }`}
                                  onClick={() =>
                                    !isDisabled &&
                                    toggleVariantSelection(variant.variantId)
                                  }
                                >
                                  <TableCell className="w-12 pl-8">
                                    <Checkbox
                                      checked={isSelected || isAdded}
                                      disabled={isDisabled}
                                      onCheckedChange={() =>
                                        !isDisabled &&
                                        toggleVariantSelection(
                                          variant.variantId
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="pointer-events-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="pl-8">
                                    <span className="text-sm text-muted-foreground">
                                      {variant.variantTitle}
                                      {isAdded && (
                                        <span className="ml-2 text-xs text-orange-600">
                                          (Already added)
                                        </span>
                                      )}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {variant.available}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {variant.currency}{" "}
                                    {parseFloat(variant.price || "0").toFixed(
                                      2
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  {Math.min((currentPage - 1) * pageSize + 1, totalCount)} -{" "}
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount}{" "}
                  variants
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage - 1;
                      setCurrentPage(newPage);
                      performSearch(
                        debouncedSearch.trim() || undefined,
                        searchBy,
                        newPage
                      );
                    }}
                    disabled={currentPage === 1 || searching}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage + 1;
                      setCurrentPage(newPage);
                      performSearch(
                        debouncedSearch.trim() || undefined,
                        searchBy,
                        newPage
                      );
                    }}
                    disabled={currentPage * pageSize >= totalCount || searching}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductPickerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddSelectedProducts}
              disabled={selectedVariants.size === 0}
            >
              Add ({selectedVariants.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
