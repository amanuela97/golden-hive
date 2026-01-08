"use client";

import type React from "react";

import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/ui/country-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "@/lib/auth-client";
import { getShippingBillingInfo } from "../actions/shipping-billing";
import { Link } from "@/i18n/navigation";
import {
  getDiscountByCodeForCheckout,
  evaluateDiscountForCheckout,
  getAutomaticDiscountsForCheckout,
  findBestDiscountForCheckout,
} from "../actions/order-discounts";
import { getManualShippingRatesForOrder } from "../actions/shipping-rates";
import { checkShippingAvailability } from "../actions/shipping-availability";
import { X, AlertCircle, Info } from "lucide-react";
import toast from "react-hot-toast";
import { type CartItem } from "@/lib/types";

export default function CheckoutPage() {
  const { items, total } = useCart();
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [loadingSavedInfo, setLoadingSavedInfo] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");

  // Discount state
  const [discountCode, setDiscountCode] = useState("");
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    discountId: string;
    discountName: string;
    discountCode: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    currency: string | null;
    totalAmount: number;
    allocations?: Array<{
      cartItemId: string;
      discountId: string;
      amount: number;
    }>;
    appliedDiscountNames?: string[]; // All discount names that are applied
    eligibilityInfo?: {
      customerEligibilityType: "all" | "specific";
      minPurchaseAmount: number | null;
      minPurchaseQuantity: number | null;
    };
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [betterDiscountMessage, setBetterDiscountMessage] = useState<
    string | null
  >(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<
    Array<{
      id: string;
      name: string;
      code: string | null;
      evaluationResult?: {
        canApply: boolean;
        reason?: string;
        missingAmount?: number;
        missingQuantity?: number;
      };
    }>
  >([]);
  const [hasDiscountsWithCodes, setHasDiscountsWithCodes] = useState(false);

  // Shipping rates state (for manual rates)
  const [shippingRates, setShippingRates] = useState<
    Array<{
      storeId: string;
      storeName: string;
      rates: Array<{
        id: string;
        serviceName: string;
        priceCents: number;
        currency: string;
        estimatedDays?: { min: number; max: number };
      }>;
    }>
  >([]);
  const [loadingShippingRates, setLoadingShippingRates] = useState(false);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<{
    storeId: string;
    rateId: string;
    serviceName: string;
    priceCents: number;
    currency: string;
  } | null>(null);
  const [shippingCost, setShippingCost] = useState(0);

  // Track items that cannot be shipped to selected country
  const [unshippableItems, setUnshippableItems] = useState<
    Array<{ itemId: string; listingId: string; name: string; reason: string }>
  >([]);
  const [checkingShippingAvailability, setCheckingShippingAvailability] =
    useState(false);

  // Form state
  const [billingData, setBillingData] = useState({
    firstName: "",
    lastName: "",
    country: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
  });

  const [shippingData, setShippingData] = useState({
    firstName: "",
    lastName: "",
    country: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
  });

  // Form validation
  const isFormValid = useMemo(() => {
    // Check billing fields
    const billingValid =
      billingData.firstName.trim() !== "" &&
      billingData.lastName.trim() !== "" &&
      billingData.email.trim() !== "" &&
      billingData.address.trim() !== "" &&
      billingData.city.trim() !== "" &&
      billingData.zip.trim() !== "" &&
      billingData.country.trim() !== "" &&
      billingData.phone.trim() !== "";

    // Check shipping fields (if shipping to different address)
    const shippingValid = shipToDifferentAddress
      ? shippingData.firstName.trim() !== "" &&
        shippingData.lastName.trim() !== "" &&
        shippingData.address.trim() !== "" &&
        shippingData.city.trim() !== "" &&
        shippingData.zip.trim() !== "" &&
        shippingData.country.trim() !== ""
      : true; // If same as billing, billing validation covers it

    // Check if shipping method is selected (if rates are available)
    const shippingMethodValid =
      shippingRates.length === 0 ||
      shippingRates.every((vr) => vr.rates.length === 0) ||
      selectedShippingMethod !== null;

    // Check if all items can be shipped to selected country
    const allItemsShippable = unshippableItems.length === 0;

    return (
      billingValid && shippingValid && shippingMethodValid && allItemsShippable
    );
  }, [
    billingData,
    shippingData,
    shipToDifferentAddress,
    shippingRates,
    selectedShippingMethod,
    unshippableItems,
  ]);

  // Load saved info if user is signed in
  useEffect(() => {
    async function loadSavedInfo() {
      if (session?.user) {
        setLoadingSavedInfo(true);
        const result = await getShippingBillingInfo();
        if (result.success && result.result) {
          // Populate billing
          if (result.result.billingFirstName) {
            setBillingData({
              firstName: result.result.billingFirstName || "",
              lastName: result.result.billingLastName || "",
              country: result.result.billingCountry || "",
              address: result.result.billingAddress || "",
              address2: result.result.billingAddress2 || "",
              city: result.result.billingCity || "",
              state: result.result.billingState || "",
              zip: result.result.billingZip || "",
              phone: result.result.billingPhone || "",
              email: result.result.billingEmail || "",
            });
          }
          // Populate shipping
          if (result.result.shippingFirstName) {
            setShippingData({
              firstName: result.result.shippingFirstName || "",
              lastName: result.result.shippingLastName || "",
              country: result.result.shippingCountry || "",
              address: result.result.shippingAddress || "",
              address2: result.result.shippingAddress2 || "",
              city: result.result.shippingCity || "",
              state: result.result.shippingState || "",
              zip: result.result.shippingZip || "",
            });
          }
        }
        setLoadingSavedInfo(false);
      } else {
        setLoadingSavedInfo(false);
      }
    }
    loadSavedInfo();
  }, [session]);

  // Calculate shipping rates when shipping address is complete
  useEffect(() => {
    async function calculateShipping() {
      const finalShippingData = shipToDifferentAddress
        ? shippingData
        : {
            firstName: billingData.firstName,
            lastName: billingData.lastName,
            country: billingData.country,
            address: billingData.address,
            address2: billingData.address2,
            city: billingData.city,
            state: billingData.state,
            zip: billingData.zip,
          };

      // Check if address is complete
      if (
        !finalShippingData.address ||
        !finalShippingData.city ||
        !finalShippingData.zip ||
        !finalShippingData.country ||
        items.length === 0
      ) {
        setShippingRates([]);
        setSelectedShippingMethod(null);
        setShippingCost(0);
        setUnshippableItems([]);
        return;
      }

      setLoadingShippingRates(true);
      setCheckingShippingAvailability(true);

      try {
        // First, check shipping availability for all items
        const availabilityChecks = await Promise.all(
          items.map(async (item) => {
            const availability = await checkShippingAvailability(
              item.listingId,
              finalShippingData.country
            );
            return {
              item,
              available: availability.available,
              message: availability.message,
            };
          })
        );

        // Find items that cannot be shipped
        const unshippable = availabilityChecks
          .filter((check) => !check.available)
          .map((check) => ({
            itemId: check.item.id,
            listingId: check.item.listingId,
            name: check.item.name,
            reason: check.message || "Shipping not available to this country",
          }));

        setUnshippableItems(unshippable);

        // If any items cannot be shipped, show warning and don't calculate rates
        if (unshippable.length > 0) {
          setShippingRates([]);
          setSelectedShippingMethod(null);
          setShippingCost(0);
          setLoadingShippingRates(false);
          setCheckingShippingAvailability(false);
          return;
        }

        const orderItems = items.map((item) => ({
          listingId: item.listingId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          storeId: item.storeId || "", // Will be fetched in getManualShippingRatesForOrder if empty
        }));

        // Use manual shipping rates
        const result = await getManualShippingRatesForOrder(
          orderItems,
          finalShippingData.country
        );

        if (result.success && result.rates) {
          // Filter out vendors with no rates
          const validRates = result.rates.filter(
            (vr) => vr.rates && vr.rates.length > 0
          );

          if (validRates.length === 0) {
            setShippingRates([]);
            setSelectedShippingMethod(null);
            setShippingCost(0);
            return;
          }

          setShippingRates(validRates);

          // Find cheapest rate across all vendors and set as default
          // For manual rates, we need to match by service name across vendors
          let cheapestRate: {
            storeId: string;
            rateId: string;
            serviceName: string;
            priceCents: number;
            currency: string;
          } | null = null;
          let cheapestPrice = Infinity;

          // Group rates by service name to find cheapest option
          const ratesByService = new Map<
            string,
            Array<{
              storeId: string;
              rateId: string;
              serviceName: string;
              priceCents: number;
              currency: string;
            }>
          >();

          for (const vendorRates of validRates) {
            for (const rate of vendorRates.rates) {
              const serviceKey = rate.serviceName;
              if (!ratesByService.has(serviceKey)) {
                ratesByService.set(serviceKey, []);
              }
              ratesByService.get(serviceKey)!.push({
                storeId: vendorRates.storeId,
                rateId: rate.id,
                serviceName: rate.serviceName,
                priceCents: rate.priceCents,
                currency: rate.currency,
              });
            }
          }

          // Find the service with the lowest total cost
          for (const [serviceName, serviceRates] of ratesByService.entries()) {
            const totalPrice = serviceRates.reduce(
              (sum, r) => sum + r.priceCents,
              0
            );
            if (totalPrice < cheapestPrice) {
              cheapestPrice = totalPrice;
              // Use the first rate as the representative (we'll track all in order creation)
              cheapestRate = serviceRates[0];
            }
          }

          if (cheapestRate) {
            setSelectedShippingMethod(cheapestRate);
            // Calculate total shipping cost (sum of all rates for selected service)
            const selectedServiceRates =
              ratesByService.get(cheapestRate.serviceName) || [];
            const totalShippingCents = selectedServiceRates.reduce(
              (sum, r) => sum + r.priceCents,
              0
            );
            setShippingCost(totalShippingCents / 100); // Convert cents to currency
          } else {
            setSelectedShippingMethod(null);
            setShippingCost(0);
          }
        } else {
          setShippingRates([]);
          setSelectedShippingMethod(null);
          setShippingCost(0);
          if (result.error) {
            console.error("Shipping rates error:", result.error);
          }
        }
      } catch (error) {
        console.error("Error calculating shipping:", error);
        setShippingRates([]);
        setSelectedShippingMethod(null);
        setShippingCost(0);
        setUnshippableItems([]);
      } finally {
        setLoadingShippingRates(false);
        setCheckingShippingAvailability(false);
      }
    }

    calculateShipping();
  }, [shipToDifferentAddress, shippingData, billingData, items]);

  // Automatically find and apply best discount when items or email change
  useEffect(() => {
    async function checkAutomaticDiscounts() {
      if (items.length === 0) {
        setAppliedDiscount(null);
        setAvailableDiscounts([]);
        return;
      }

      try {
        const cartItemsForEvaluation = items.map((item) => ({
          id: item.id,
          listingId: item.listingId,
          variantId: item.variantId || null,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }));

        // Find the best discount (only automatic ones without codes for auto-apply)
        const bestDiscountResult = await findBestDiscountForCheckout(
          cartItemsForEvaluation,
          billingData.email || null,
          undefined, // excludeDiscountId
          true // excludeDiscountsWithCodes - only auto-apply discounts without codes
        );

        if (bestDiscountResult.success && bestDiscountResult.bestDiscount) {
          const best = bestDiscountResult.bestDiscount;

          // Only auto-apply if it doesn't require a code
          if (!best.discountCode) {
            // Check if we already have this discount applied
            if (
              !appliedDiscount ||
              appliedDiscount.discountId !== best.discountId
            ) {
              setAppliedDiscount({
                discountId: best.discountId,
                discountName: best.discountName,
                discountCode: best.discountCode,
                valueType: best.valueType,
                value: best.value,
                currency: best.currency,
                totalAmount: best.totalAmount,
                allocations: best.allocations,
                appliedDiscountNames: best.appliedDiscountNames,
                eligibilityInfo: best.eligibilityInfo,
              });
              setBetterDiscountMessage(null);
            }
          }
        }

        // Get all automatic discounts to show requirements
        const automaticDiscountsResult = await getAutomaticDiscountsForCheckout(
          cartItemsForEvaluation,
          billingData.email || null
        );

        if (
          automaticDiscountsResult.success &&
          automaticDiscountsResult.discounts
        ) {
          // Check if there are any discounts with codes that could apply
          const discountsWithCodes = automaticDiscountsResult.discounts.filter(
            (d) => d.code && d.evaluationResult && d.evaluationResult.canApply
          );
          setHasDiscountsWithCodes(discountsWithCodes.length > 0);

          // Only show discounts that apply to cart items but don't meet requirements
          // Filter out discounts that don't apply to any items
          setAvailableDiscounts(
            automaticDiscountsResult.discounts
              .filter((d) => {
                // Only show if it applies to items but can't be applied (due to requirements)
                // Don't show if it doesn't apply to any items at all
                return (
                  d.evaluationResult &&
                  !d.evaluationResult.canApply &&
                  d.evaluationResult.reason !==
                    "Discount does not apply to any items in cart"
                );
              })
              .map((d) => ({
                id: d.id,
                name: d.name,
                code: d.code,
                evaluationResult: d.evaluationResult,
              }))
          );
        } else {
          setHasDiscountsWithCodes(false);
        }
      } catch (error) {
        console.error("Error checking automatic discounts:", error);
      }
    }

    // Debounce to avoid too many calls
    const timeoutId = setTimeout(() => {
      checkAutomaticDiscounts();
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, billingData.email, appliedDiscount?.discountId]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountError("Please enter a discount code");
      return;
    }

    setApplyingDiscount(true);
    setDiscountError(null);

    try {
      // First, get discount by code
      const discountResult = await getDiscountByCodeForCheckout(
        discountCode.trim().toUpperCase()
      );

      if (!discountResult.success || !discountResult.discount) {
        setDiscountError(
          discountResult.error || "Discount code not found or expired"
        );
        return;
      }

      const discount = discountResult.discount;

      // Check eligibility info
      if (discount.customerEligibilityType === "specific") {
        // For specific customers, we need to check if customer email matches
        // We'll evaluate it and show appropriate message
      }

      // Evaluate discount against cart items
      const cartItemsForEvaluation = items.map((item) => ({
        id: item.id,
        listingId: item.listingId,
        variantId: item.variantId || null,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const evaluationResult = await evaluateDiscountForCheckout(
        discount.id,
        cartItemsForEvaluation,
        billingData.email || null
      );

      if (!evaluationResult.success || !evaluationResult.result) {
        let errorMessage =
          evaluationResult.validationError ||
          evaluationResult.error ||
          "Failed to apply discount";

        // Add helpful context about requirements
        if (evaluationResult.eligibilityInfo) {
          const info = evaluationResult.eligibilityInfo;
          if (info.customerEligibilityType === "specific") {
            errorMessage =
              "This discount is only available to specific customers. Please sign in or contact support.";
          } else if (info.minPurchaseAmount) {
            errorMessage = `Minimum purchase of ${discount.currency || "€"}${info.minPurchaseAmount} required. Add €${(info.minPurchaseAmount - total).toFixed(2)} more to your cart.`;
          } else if (info.minPurchaseQuantity) {
            errorMessage = `Minimum quantity of ${info.minPurchaseQuantity} items required.`;
          }
        }

        setDiscountError(errorMessage);
        return;
      }

      // Check if the new discount applies to different items than the currently applied discount
      // If they apply to different items, we should combine them using evaluateBestDiscountsPerItem
      const newDiscountItemIds = new Set(
        evaluationResult.result.allocations?.map((a) => a.cartItemId) || []
      );
      const appliedDiscountItemIds = new Set(
        appliedDiscount?.allocations?.map((a) => a.cartItemId) || []
      );

      // Check if discounts apply to overlapping items
      const hasOverlap = Array.from(newDiscountItemIds).some((id) =>
        appliedDiscountItemIds.has(id)
      );

      // If discounts apply to the same items (overlap), check which is better
      if (appliedDiscount && hasOverlap) {
        // They apply to some of the same items, check if the applied discount is better
        if (appliedDiscount.totalAmount > evaluationResult.result.totalAmount) {
          setBetterDiscountMessage(
            `A better discount (${appliedDiscount.discountName}) is already applied to these items. Only one discount can be applied per item.`
          );
          setDiscountError(null);
          return;
        }
        // If the new discount is better for overlapping items, we'll replace via findBestDiscountForCheckout below
      }

      // If discounts apply to different items (no overlap), we should combine them
      // Always use findBestDiscountForCheckout to evaluate all discounts and pick best per item
      // This handles both cases: different items (combine) and same items (pick best)

      // Successfully applied discount
      // When a code is entered, re-evaluate all discounts to get the best per item
      // This ensures we show all discount names if multiple discounts apply
      const allBestDiscountResult = await findBestDiscountForCheckout(
        cartItemsForEvaluation,
        billingData.email || null,
        undefined, // excludeDiscountId
        false // include discounts with codes since user entered a code
      );

      if (allBestDiscountResult.success && allBestDiscountResult.bestDiscount) {
        const best = allBestDiscountResult.bestDiscount;
        setAppliedDiscount({
          discountId: best.discountId,
          discountName: best.discountName,
          discountCode: best.discountCode,
          valueType: best.valueType,
          value: best.value,
          currency: best.currency,
          totalAmount: best.totalAmount,
          allocations: best.allocations,
          appliedDiscountNames: best.appliedDiscountNames,
          eligibilityInfo: best.eligibilityInfo,
        });
      } else {
        // Fallback to the evaluation result if re-evaluation fails
        setAppliedDiscount({
          discountId: discount.id,
          discountName: evaluationResult.result.discountName,
          discountCode: evaluationResult.result.discountCode,
          valueType: evaluationResult.result.valueType,
          value: evaluationResult.result.value,
          currency: evaluationResult.result.currency,
          totalAmount: evaluationResult.result.totalAmount,
          allocations: evaluationResult.result.allocations,
          appliedDiscountNames: [evaluationResult.result.discountName],
          eligibilityInfo: evaluationResult.eligibilityInfo,
        });
      }

      setBetterDiscountMessage(null);
      toast.success("Discount applied successfully!");
    } catch (error) {
      console.error("Error applying discount:", error);
      setDiscountError(
        error instanceof Error ? error.message : "Failed to apply discount"
      );
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
    setDiscountError(null);
    setBetterDiscountMessage(null);
    toast.success("Discount removed");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent order if any items cannot be shipped
    if (unshippableItems.length > 0) {
      toast.error(
        `Cannot proceed: Some items cannot be shipped to the selected country. Please remove them or change your shipping address.`
      );
      return;
    }

    // Validate checkout permissions (if user is logged in)
    if (session?.user?.id) {
      try {
        const { validateCheckoutPermissions } = await import(
          "../actions/checkout-validation"
        );
        const listingIds = items.map((item) => item.listingId);
        const permissionCheck = await validateCheckoutPermissions(listingIds);

        if (!permissionCheck.allowed) {
          toast.error(permissionCheck.error || "Cannot proceed with checkout");
          return;
        }
      } catch (error) {
        console.error("Error validating checkout permissions:", error);
        // Continue anyway - backend will catch it
      }
    }

    setIsProcessing(true);

    try {
      // Calculate totals
      // Subtotal should be the sum of all items before discounts
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const shipping = shippingCost;
      const tax = 0; // TODO: Calculate tax
      const discount = appliedDiscount?.totalAmount || 0;
      const finalTotal = subtotal + shipping + tax - discount;

      // Determine shipping data (use shipping if different, else billing)
      const finalShippingData = shipToDifferentAddress
        ? shippingData
        : {
            firstName: billingData.firstName,
            lastName: billingData.lastName,
            country: billingData.country,
            address: billingData.address,
            address2: billingData.address2,
            city: billingData.city,
            state: billingData.state,
            zip: billingData.zip,
          };

      // 1. Create order
      const orderResponse = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: billingData.email,
          customerFirstName: billingData.firstName,
          customerLastName: billingData.lastName,
          customerPhone: billingData.phone,
          lineItems: items.map((item) => {
            // Find discount allocation for this item
            const allocation = appliedDiscount?.allocations?.find(
              (a) => a.cartItemId === item.id
            );

            return {
              listingId: item.listingId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.price.toString(),
              title: item.name,
              sku: item.sku || null,
              discountAmount: allocation ? allocation.amount.toFixed(2) : "0",
              discountId: allocation ? allocation.discountId : null,
            };
          }),
          currency: "EUR", // Default to EUR, can be detected from items
          subtotalAmount: subtotal.toFixed(2),
          shippingAmount: shipping.toFixed(2),
          taxAmount: tax.toFixed(2),
          discountAmount: discount.toFixed(2),
          discountId: appliedDiscount?.discountId || null,
          totalAmount: finalTotal.toFixed(2),
          shippingName: `${finalShippingData.firstName} ${finalShippingData.lastName}`,
          shippingPhone: billingData.phone,
          shippingAddressLine1: finalShippingData.address,
          shippingAddressLine2: finalShippingData.address2 || null,
          shippingCity: finalShippingData.city,
          shippingRegion: finalShippingData.state,
          shippingPostalCode: finalShippingData.zip,
          shippingCountry: finalShippingData.country,
          billingName: `${billingData.firstName} ${billingData.lastName}`,
          billingPhone: billingData.phone,
          billingAddressLine1: billingData.address,
          billingAddressLine2: billingData.address2 || null,
          billingCity: billingData.city,
          billingRegion: billingData.state,
          billingPostalCode: billingData.zip,
          billingCountry: billingData.country,
          notes: orderNotes || null,
          shippingMethod: selectedShippingMethod
            ? selectedShippingMethod.serviceName
            : null,
          shippingService: selectedShippingMethod?.serviceName || null,
          vendorShippingRates: shippingRates
            .map((vendorRates) => {
              // Find the selected rate for this vendor matching the service name
              let selectedRate = vendorRates.rates.find(
                (r) =>
                  r.id === selectedShippingMethod?.rateId &&
                  r.serviceName === selectedShippingMethod?.serviceName
              );
              if (!selectedRate && selectedShippingMethod) {
                // If exact rate not found, use matching service name
                selectedRate = vendorRates.rates.find(
                  (r) => r.serviceName === selectedShippingMethod.serviceName
                );
              }
              if (!selectedRate && vendorRates.rates.length > 0) {
                // Fallback to cheapest
                selectedRate = vendorRates.rates.reduce((prev, curr) =>
                  curr.priceCents < prev.priceCents ? curr : prev
                );
              }
              if (!selectedRate) {
                return null;
              }
              return {
                storeId: vendorRates.storeId,
                rateId: selectedRate.id,
                serviceName: selectedRate.serviceName,
                priceCents: selectedRate.priceCents,
                currency: selectedRate.currency,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null),
        }),
      });

      const orderResult = await orderResponse.json();

      if (!orderResult.success) {
        throw new Error(orderResult.error || "Failed to create order");
      }

      // Handle multiple orders (multi-store checkout)
      const orders = orderResult.orders || [
        { orderId: orderResult.orderId || orderResult.primaryOrderId },
      ];

      if (orders.length === 0) {
        throw new Error("No orders created");
      }

      // For now, if multiple stores, we'll create a combined checkout
      // In the future, this could be enhanced to create separate checkout sessions
      // and redirect through them sequentially

      // Create Stripe Checkout Session for all orders
      // We'll pass all order IDs and let the API handle the payment split
      const checkoutResponse = await fetch("/api/stripe/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: orders.map((o: { orderId: string }) => o.orderId), // Pass all order IDs
          currency: "EUR",
          items: items.map((item) => ({
            listingId: item.listingId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          customerEmail: billingData.email,
        }),
      });

      const checkoutResult = await checkoutResponse.json();

      if (checkoutResult.error || !checkoutResult.url) {
        throw new Error(
          checkoutResult.error || "Failed to create checkout session"
        );
      }

      // Redirect to Stripe Checkout
      window.location.href = checkoutResult.url;
    } catch (error) {
      console.error("Checkout error:", error);
      // Show error toast
      alert(
        error instanceof Error
          ? error.message
          : "An error occurred during checkout. Please try again."
      );
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold mb-4 text-foreground">
              Your cart is empty
            </h1>
            <p className="text-muted-foreground mb-8">
              Looks like you haven&apos;t added any items to your cart yet.
            </p>
            <Button asChild size="lg">
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8 text-foreground">Checkout</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Billing Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Billing Information */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-2xl font-bold mb-6 text-foreground">
                  Billing Details
                </h2>

                {loadingSavedInfo && session?.user ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Loading saved information...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!session?.user && (
                      <div className="mb-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">
                          Have an account?{" "}
                          <Link
                            href="/login"
                            className="text-primary hover:underline"
                          >
                            Sign in
                          </Link>{" "}
                          to save your information for faster checkout.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={billingData.firstName}
                          onChange={(e) =>
                            setBillingData({
                              ...billingData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={billingData.lastName}
                          onChange={(e) =>
                            setBillingData({
                              ...billingData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <CountrySelect
                        id="country"
                        value={billingData.country}
                        onValueChange={(value) =>
                          setBillingData({ ...billingData, country: value })
                        }
                        placeholder="Select Country"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        placeholder="House number and street name"
                        value={billingData.address}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            address: e.target.value,
                          })
                        }
                        required
                        className="mb-2"
                      />
                      <Input
                        id="address2"
                        placeholder="Apartment, suite, unit, etc. (optional)"
                        value={billingData.address2}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            address2: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={billingData.city}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            city: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="state">State / Province</Label>
                        <Input
                          id="state"
                          value={billingData.state}
                          onChange={(e) =>
                            setBillingData({
                              ...billingData,
                              state: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip">ZIP / Postal Code</Label>
                        <Input
                          id="zip"
                          value={billingData.zip}
                          onChange={(e) =>
                            setBillingData({
                              ...billingData,
                              zip: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={billingData.phone}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            phone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={billingData.email}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Ship to Different Address */}
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="shipDifferent"
                    checked={shipToDifferentAddress}
                    onCheckedChange={(checked) =>
                      setShipToDifferentAddress(checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="shipDifferent"
                    className="cursor-pointer font-medium"
                  >
                    Ship to a different address
                  </Label>
                </div>

                {shipToDifferentAddress && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipFirstName">First Name</Label>
                        <Input
                          id="shipFirstName"
                          value={shippingData.firstName}
                          onChange={(e) =>
                            setShippingData({
                              ...shippingData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shipLastName">Last Name</Label>
                        <Input
                          id="shipLastName"
                          value={shippingData.lastName}
                          onChange={(e) =>
                            setShippingData({
                              ...shippingData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shipCountry">Country</Label>
                      <CountrySelect
                        id="shipCountry"
                        value={shippingData.country}
                        onValueChange={(value) =>
                          setShippingData({ ...shippingData, country: value })
                        }
                        placeholder="Select Country"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shipAddress">Street Address</Label>
                      <Input
                        id="shipAddress"
                        placeholder="House number and street name"
                        value={shippingData.address}
                        onChange={(e) =>
                          setShippingData({
                            ...shippingData,
                            address: e.target.value,
                          })
                        }
                        required
                        className="mb-2"
                      />
                      <Input
                        id="shipAddress2"
                        placeholder="Apartment, suite, unit, etc. (optional)"
                        value={shippingData.address2}
                        onChange={(e) =>
                          setShippingData({
                            ...shippingData,
                            address2: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shipCity">City</Label>
                      <Input
                        id="shipCity"
                        value={shippingData.city}
                        onChange={(e) =>
                          setShippingData({
                            ...shippingData,
                            city: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipState">State / Province</Label>
                        <Input
                          id="shipState"
                          value={shippingData.state}
                          onChange={(e) =>
                            setShippingData({
                              ...shippingData,
                              state: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shipZip">ZIP / Postal Code</Label>
                        <Input
                          id="shipZip"
                          value={shippingData.zip}
                          onChange={(e) =>
                            setShippingData({
                              ...shippingData,
                              zip: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Notes */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">
                  Additional Information
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="orderNotes">Order Notes (optional)</Label>
                  <Textarea
                    id="orderNotes"
                    placeholder="Notes about your order, e.g. special delivery instructions"
                    rows={4}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg border border-border p-6 sticky top-4">
                <h2 className="text-2xl font-bold mb-6 text-foreground">
                  Your Order
                </h2>

                {/* Shipping Availability Warnings */}
                {unshippableItems.length > 0 && (
                  <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-destructive mb-2">
                          Shipping Not Available
                        </h3>
                        <p className="text-sm text-destructive mb-2">
                          The following items cannot be shipped to the selected
                          country:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                          {unshippableItems.map((item) => (
                            <li key={item.itemId}>
                              {item.name} - {item.reason}
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm text-destructive mt-2">
                          Please remove these items or change your shipping
                          address to continue.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between font-medium text-sm pb-3 border-b border-border">
                    <span>Product</span>
                    <span>Subtotal</span>
                  </div>

                  {items.map((item: CartItem) => {
                    const isUnshippable = unshippableItems.some(
                      (u) => u.itemId === item.id
                    );
                    const itemSubtotal = item.price * item.quantity;
                    const allocation = appliedDiscount?.allocations?.find(
                      (a) => a.cartItemId === item.id
                    );
                    const itemDiscount = allocation ? allocation.amount : 0;
                    const itemTotal = itemSubtotal - itemDiscount;

                    return (
                      <div
                        key={item.id}
                        className={`space-y-2 ${
                          isUnshippable ? "opacity-50" : ""
                        }`}
                      >
                        {isUnshippable && (
                          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                            <AlertCircle className="w-4 h-4" />
                            <span>Cannot ship to selected country</span>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-muted">
                            <Image
                              src={item.image || "/placeholder.svg"}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {item.name}
                            </p>
                            {item.variantTitle && (
                              <p className="text-xs text-primary font-medium mt-1">
                                {item.variantTitle}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-medium text-foreground">
                              {item.currency || "€"} {itemTotal.toFixed(2)}
                            </div>
                            {itemDiscount > 0 && (
                              <div className="text-xs text-muted-foreground line-through">
                                {item.currency || "€"} {itemSubtotal.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {itemDiscount > 0 && (
                          <div className="flex justify-end text-xs text-destructive">
                            <span>
                              Discount: -{item.currency || "€"}
                              {itemDiscount.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Separator className="my-4" />

                {/* Discount Code */}
                <div className="space-y-3 mb-4">
                  <Label htmlFor="discountCode" className="text-sm font-medium">
                    Discount Code
                  </Label>
                  {appliedDiscount && !hasDiscountsWithCodes ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {appliedDiscount.appliedDiscountNames &&
                            appliedDiscount.appliedDiscountNames.length > 1 ? (
                              <div className="space-y-1">
                                {appliedDiscount.appliedDiscountNames.map(
                                  (name, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1"
                                    >
                                      <span>{name}</span>
                                      {idx <
                                        appliedDiscount.appliedDiscountNames!
                                          .length -
                                          1 && (
                                        <span className="text-muted-foreground">
                                          +
                                        </span>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <>
                                {appliedDiscount.discountName}
                                {appliedDiscount.discountCode && (
                                  <span className="text-muted-foreground ml-1">
                                    ({appliedDiscount.discountCode})
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {appliedDiscount.appliedDiscountNames &&
                            appliedDiscount.appliedDiscountNames.length > 1 ? (
                              <span>Multiple discounts applied</span>
                            ) : (
                              <>
                                {appliedDiscount.valueType === "percentage"
                                  ? `${appliedDiscount.value}% off`
                                  : `${appliedDiscount.currency || "€"}${appliedDiscount.value} off`}
                              </>
                            )}
                          </div>
                          {appliedDiscount.eligibilityInfo && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {appliedDiscount.eligibilityInfo
                                .customerEligibilityType === "specific" && (
                                <span className="text-amber-600">
                                  Available to specific customers only
                                </span>
                              )}
                              {appliedDiscount.eligibilityInfo
                                .minPurchaseAmount && (
                                <div>
                                  Min. purchase:{" "}
                                  {appliedDiscount.currency || "€"}
                                  {
                                    appliedDiscount.eligibilityInfo
                                      .minPurchaseAmount
                                  }
                                </div>
                              )}
                              {appliedDiscount.eligibilityInfo
                                .minPurchaseQuantity && (
                                <div>
                                  Min. quantity:{" "}
                                  {
                                    appliedDiscount.eligibilityInfo
                                      .minPurchaseQuantity
                                  }{" "}
                                  items
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={handleRemoveDiscount}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {appliedDiscount && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {appliedDiscount.appliedDiscountNames &&
                              appliedDiscount.appliedDiscountNames.length >
                                1 ? (
                                <div className="space-y-1">
                                  {appliedDiscount.appliedDiscountNames.map(
                                    (name, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1"
                                      >
                                        <span>{name}</span>
                                        {idx <
                                          appliedDiscount.appliedDiscountNames!
                                            .length -
                                            1 && (
                                          <span className="text-muted-foreground">
                                            +
                                          </span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                <>
                                  {appliedDiscount.discountName}
                                  {appliedDiscount.discountCode && (
                                    <span className="text-muted-foreground ml-1">
                                      ({appliedDiscount.discountCode})
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {appliedDiscount.appliedDiscountNames &&
                              appliedDiscount.appliedDiscountNames.length >
                                1 ? (
                                <span>Multiple discounts applied</span>
                              ) : (
                                <>
                                  {appliedDiscount.valueType === "percentage"
                                    ? `${appliedDiscount.value}% off`
                                    : `${appliedDiscount.currency || "€"}${appliedDiscount.value} off`}
                                </>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={handleRemoveDiscount}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {/* Always show discount code input when there are items in cart */}
                      {items.length > 0 && (
                        <div className="flex gap-2">
                          <Input
                            id="discountCode"
                            placeholder="Enter discount code"
                            value={discountCode}
                            onChange={(e) => {
                              setDiscountCode(e.target.value.toUpperCase());
                              setDiscountError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyDiscount();
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleApplyDiscount}
                            disabled={applyingDiscount || !discountCode.trim()}
                          >
                            {applyingDiscount ? "Applying..." : "Apply"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {betterDiscountMessage && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-800">
                        {betterDiscountMessage}
                      </p>
                    </div>
                  )}
                  {discountError && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">
                        {discountError}
                      </p>
                    </div>
                  )}
                  {/* Show available discounts with requirements */}
                  {availableDiscounts.length > 0 && !appliedDiscount && (
                    <div className="space-y-2 mt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Available Discounts:
                      </p>
                      {availableDiscounts.map((discount) => {
                        if (discount.evaluationResult?.canApply) return null;
                        return (
                          <div
                            key={discount.id}
                            className="p-2 bg-muted rounded-md text-xs"
                          >
                            <div className="font-medium">{discount.name}</div>
                            {discount.evaluationResult?.reason && (
                              <div className="text-muted-foreground mt-1">
                                {discount.evaluationResult.reason}
                                {discount.evaluationResult.missingAmount && (
                                  <span className="ml-1">
                                    Add €
                                    {discount.evaluationResult.missingAmount.toFixed(
                                      2
                                    )}{" "}
                                    more.
                                  </span>
                                )}
                                {discount.evaluationResult.missingQuantity && (
                                  <span className="ml-1">
                                    Add{" "}
                                    {discount.evaluationResult.missingQuantity}{" "}
                                    more item(s).
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      €
                      {items
                        .reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        )
                        .toFixed(2)}
                    </span>
                  </div>

                  {appliedDiscount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {appliedDiscount.appliedDiscountNames &&
                        appliedDiscount.appliedDiscountNames.length > 1 ? (
                          <>
                            Discount (
                            {appliedDiscount.appliedDiscountNames.join(", ")})
                          </>
                        ) : (
                          <>Discount ({appliedDiscount.discountName})</>
                        )}
                      </span>
                      <span className="font-medium text-destructive">
                        -€{appliedDiscount.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-foreground">
                        {loadingShippingRates
                          ? "Calculating..."
                          : shippingCost > 0
                            ? `€${shippingCost.toFixed(2)}`
                            : "Free"}
                      </span>
                    </div>
                    {shippingRates.length > 0 &&
                      shippingRates.some((vr) => vr.rates.length > 0) && (
                        <div className="space-y-2">
                          <Label className="text-xs">Shipping Method</Label>
                          <Select
                            value={
                              selectedShippingMethod
                                ? `${selectedShippingMethod.storeId}-${selectedShippingMethod.rateId}`
                                : ""
                            }
                            onValueChange={(value) => {
                              const [storeId, rateId] = value.split("-");
                              const vendorRates = shippingRates.find(
                                (r) => r.storeId === storeId
                              );
                              if (vendorRates) {
                                const rate = vendorRates.rates.find(
                                  (r) => r.id === rateId
                                );
                                if (rate) {
                                  setSelectedShippingMethod({
                                    storeId,
                                    rateId: rate.id,
                                    serviceName: rate.serviceName,
                                    priceCents: rate.priceCents,
                                    currency: rate.currency,
                                  });
                                  // Recalculate total shipping - find all rates with same service name
                                  const selectedServiceName = rate.serviceName;
                                  let totalShippingCents = 0;
                                  for (const vr of shippingRates) {
                                    const matchingRate = vr.rates.find(
                                      (r) =>
                                        r.serviceName === selectedServiceName
                                    );
                                    if (matchingRate) {
                                      totalShippingCents +=
                                        matchingRate.priceCents;
                                    } else if (vr.rates.length > 0) {
                                      // Fallback to cheapest for that vendor
                                      const cheapest = vr.rates.reduce(
                                        (prev, curr) =>
                                          curr.priceCents < prev.priceCents
                                            ? curr
                                            : prev
                                      );
                                      totalShippingCents += cheapest.priceCents;
                                    }
                                  }
                                  setShippingCost(totalShippingCents / 100);
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select shipping method" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                // Group rates by service name across all vendors
                                const servicesMap = new Map<
                                  string,
                                  Array<{
                                    storeId: string;
                                    storeName: string;
                                    rate: {
                                      id: string;
                                      serviceName: string;
                                      priceCents: number;
                                      currency: string;
                                    };
                                  }>
                                >();

                                for (const vendorRates of shippingRates.filter(
                                  (vr) => vr.rates.length > 0
                                )) {
                                  for (const rate of vendorRates.rates) {
                                    if (!servicesMap.has(rate.serviceName)) {
                                      servicesMap.set(rate.serviceName, []);
                                    }
                                    servicesMap.get(rate.serviceName)!.push({
                                      storeId: vendorRates.storeId,
                                      storeName: vendorRates.storeName,
                                      rate,
                                    });
                                  }
                                }

                                return Array.from(servicesMap.entries()).map(
                                  ([serviceName, serviceRates]) => {
                                    const totalPriceCents = serviceRates.reduce(
                                      (sum, sr) => sum + sr.rate.priceCents,
                                      0
                                    );
                                    const currency =
                                      serviceRates[0]?.rate.currency || "EUR";
                                    const price = (
                                      totalPriceCents / 100
                                    ).toFixed(2);
                                    // Use first vendor's rate ID as the key
                                    const firstRate = serviceRates[0].rate;
                                    const firstStoreId =
                                      serviceRates[0].storeId;

                                    return (
                                      <SelectItem
                                        key={`${firstStoreId}-${firstRate.id}`}
                                        value={`${firstStoreId}-${firstRate.id}`}
                                      >
                                        {serviceName} -{" "}
                                        {currency === "EUR"
                                          ? "€"
                                          : currency === "USD"
                                            ? "$"
                                            : currency}
                                        {price}
                                        {shippingRates.length > 1 &&
                                          ` (Ships from ${serviceRates.length} vendor${serviceRates.length > 1 ? "s" : ""})`}
                                      </SelectItem>
                                    );
                                  }
                                );
                              })()}
                            </SelectContent>
                          </Select>
                          {shippingRates.length > 1 && (
                            <p className="text-xs text-muted-foreground">
                              Ships from {shippingRates.length} vendor
                              {shippingRates.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      )}
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-foreground">
                      €
                      {(total + shippingCost - (appliedDiscount?.totalAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Payment Method */}
                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-foreground">
                    Payment Method
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <input
                        type="radio"
                        id="cod"
                        name="payment"
                        value="cod"
                        defaultChecked
                        className="mt-1"
                      />
                      <div>
                        <Label
                          htmlFor="cod"
                          className="cursor-pointer font-medium"
                        >
                          Credit Card / Debit Card
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Secure payment via Stripe
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Your personal data will be used to process your order, support
                  your experience throughout this website, and for other
                  purposes described in our privacy policy.
                </p>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={
                    isProcessing ||
                    !isFormValid ||
                    unshippableItems.length > 0 ||
                    checkingShippingAvailability
                  }
                >
                  {isProcessing
                    ? "Processing..."
                    : checkingShippingAvailability
                      ? "Checking shipping..."
                      : unshippableItems.length > 0
                        ? "Cannot Ship Items"
                        : "Place Order"}
                </Button>
                {!isFormValid && unshippableItems.length === 0 && (
                  <p className="text-xs text-destructive text-center mt-2">
                    Please fill in all required fields
                  </p>
                )}
                {unshippableItems.length > 0 && (
                  <p className="text-xs text-destructive text-center mt-2">
                    Some items cannot be shipped to the selected country
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
