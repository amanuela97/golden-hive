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
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getShippingBillingInfo } from "@/app/actions/shipping-billing";

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const { data: session } = useSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [loadingSavedInfo, setLoadingSavedInfo] = useState(true);

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

    // Simulate order processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clear cart and redirect
    clearCart();
    router.push("/order-confirmation");
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
              Add some products to your cart before checking out.
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
                  Billing details
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
                          Already have an account?{" "}
                          <Link
                            href="/login"
                            className="text-primary hover:underline"
                          >
                            Sign in
                          </Link>{" "}
                          to use your saved information.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name *</Label>
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
                        <Label htmlFor="lastName">Last name *</Label>
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
                      <Label htmlFor="company">Company name (optional)</Label>
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
                      <Label htmlFor="country">Country / Region *</Label>
                      <Select
                        value={billingData.country}
                        onValueChange={(value) =>
                          setBillingData({ ...billingData, country: value })
                        }
                        required
                      >
                        <SelectTrigger id="country" className="w-full">
                          <SelectValue placeholder="Select a country" />
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
                      <Label htmlFor="address">Street address *</Label>
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
                      <Label htmlFor="city">Town / City *</Label>
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
                        <Label htmlFor="state">State *</Label>
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
                        <Label htmlFor="zip">ZIP Code *</Label>
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
                      <Label htmlFor="phone">Phone *</Label>
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
                      <Label htmlFor="email">Email address *</Label>
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
                    Ship to a different address?
                  </Label>
                </div>

                {shipToDifferentAddress && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipFirstName">First name *</Label>
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
                        <Label htmlFor="shipLastName">Last name *</Label>
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
                      <Label htmlFor="shipCompany">
                        Company name (optional)
                      </Label>
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
                      <Label htmlFor="shipCountry">Country / Region *</Label>
                      <Select
                        value={shippingData.country}
                        onValueChange={(value) =>
                          setShippingData({ ...shippingData, country: value })
                        }
                        required
                      >
                        <SelectTrigger id="shipCountry" className="w-full">
                          <SelectValue placeholder="Select a country" />
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
                      <Label htmlFor="shipAddress">Street address *</Label>
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
                      <Label htmlFor="shipCity">Town / City *</Label>
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
                        <Label htmlFor="shipState">State *</Label>
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
                        <Label htmlFor="shipZip">ZIP Code *</Label>
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
                  Additional information
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="orderNotes">Order notes (optional)</Label>
                  <Textarea
                    id="orderNotes"
                    placeholder="Notes about your order, e.g. special notes for delivery."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg border border-border p-6 sticky top-4">
                <h2 className="text-2xl font-bold mb-6 text-foreground">
                  Your order
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
                    <span className="font-medium text-foreground">
                      Free shipping
                    </span>
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
                    Payment method
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
                          Cash on delivery
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pay with cash upon delivery.
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
                  {isProcessing ? "Processing..." : "Place order"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
