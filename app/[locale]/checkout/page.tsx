"use client";

import type React from "react";

import { useCart, type CartItem } from "@/lib/cart-context";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { getShippingBillingInfo } from "../actions/shipping-billing";
import { Link, useRouter } from "@/i18n/navigation";

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [loadingSavedInfo, setLoadingSavedInfo] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");

  // Form state
  const [billingData, setBillingData] = useState({
    firstName: "",
    lastName: "",
    company: "",
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
    company: "",
    country: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
  });

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
              company: result.result.billingCompany || "",
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
              company: result.result.shippingCompany || "",
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Calculate totals
      const subtotal = total;
      const shipping = 0; // TODO: Calculate shipping
      const tax = 0; // TODO: Calculate tax
      const discount = 0;
      const finalTotal = subtotal + shipping + tax - discount;

      // Determine shipping data (use shipping if different, else billing)
      const finalShippingData = shipToDifferentAddress
        ? shippingData
        : {
            firstName: billingData.firstName,
            lastName: billingData.lastName,
            company: billingData.company,
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
          lineItems: items.map((item) => ({
            listingId: item.listingId,
            variantId: item.variantId || null,
            quantity: item.quantity,
            unitPrice: item.price.toString(),
            title: item.name,
            sku: item.sku || null,
          })),
          currency: "EUR", // Default to EUR, can be detected from items
          subtotalAmount: subtotal.toFixed(2),
          shippingAmount: shipping.toFixed(2),
          taxAmount: tax.toFixed(2),
          discountAmount: discount.toFixed(2),
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
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={billingData.company}
                        onChange={(e) =>
                          setBillingData({
                            ...billingData,
                            company: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={billingData.country}
                        onValueChange={(value) =>
                          setBillingData({ ...billingData, country: value })
                        }
                        required
                      >
                        <SelectTrigger id="country" className="w-full">
                          <SelectValue placeholder="Select Country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="uk">United Kingdom</SelectItem>
                          <SelectItem value="ca">Canada</SelectItem>
                          <SelectItem value="au">Australia</SelectItem>
                          <SelectItem value="np">Nepal</SelectItem>
                          <SelectItem value="in">India</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Label htmlFor="shipCompany">Company Name</Label>
                      <Input
                        id="shipCompany"
                        value={shippingData.company}
                        onChange={(e) =>
                          setShippingData({
                            ...shippingData,
                            company: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shipCountry">Country</Label>
                      <Select
                        value={shippingData.country}
                        onValueChange={(value) =>
                          setShippingData({ ...shippingData, country: value })
                        }
                        required
                      >
                        <SelectTrigger id="shipCountry" className="w-full">
                          <SelectValue placeholder="Select Country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="uk">United Kingdom</SelectItem>
                          <SelectItem value="ca">Canada</SelectItem>
                          <SelectItem value="au">Australia</SelectItem>
                          <SelectItem value="np">Nepal</SelectItem>
                          <SelectItem value="in">India</SelectItem>
                        </SelectContent>
                      </Select>
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

                {/* Order Items */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between font-medium text-sm pb-3 border-b border-border">
                    <span>Product</span>
                    <span>Subtotal</span>
                  </div>

                  {items.map((item: CartItem) => (
                    <div key={item.id} className="flex gap-3">
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
                      <div className="text-sm font-medium text-foreground shrink-0">
                        {item.currency || "NPR"}{" "}
                        {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      €{total.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium text-foreground">Free</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-foreground">
                      €{total.toFixed(2)}
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
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Place Order"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
