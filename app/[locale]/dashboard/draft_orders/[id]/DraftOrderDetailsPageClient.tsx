"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  MoreVertical,
  Copy,
  Trash2,
  Plus,
  Minus,
  X,
  Search,
  Mail,
  CreditCard,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  getDraftOrder,
  updateDraftOrderItems,
  deleteDraftOrders,
  duplicateDraftOrder,
  sendInvoice,
  completeDraftOrder,
} from "@/app/[locale]/actions/draft-orders";
import { searchProductsForOrder } from "@/app/[locale]/actions/orders";
import { PaymentSummary } from "../../orders/[id]/components/PaymentSummary";

interface DraftOrderItem {
  id: string;
  listingId: string | null;
  variantId: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  lineTotal: string;
  currency: string;
  imageUrl: string | null;
}

interface DraftOrderData {
  id: string;
  draftNumber: number;
  customerId: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  paymentStatus: "pending" | "paid";
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  billingName: string | null;
  billingPhone: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingRegion: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  marketId: string | null;
  items: DraftOrderItem[];
}

interface DraftOrderDetailsPageClientProps {
  draftData: DraftOrderData;
  userRole: "admin" | "seller" | "customer";
}

export default function DraftOrderDetailsPageClient({
  draftData: initialDraftData,
  userRole,
}: DraftOrderDetailsPageClientProps) {
  const router = useRouter();
  const [draftData, setDraftData] = useState(initialDraftData);
  const [loading, setLoading] = useState(false);
  const [showSendInvoiceDialog, setShowSendInvoiceDialog] = useState(false);
  const [showMarkAsPaidDialog, setShowMarkAsPaidDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [invoiceEmail, setInvoiceEmail] = useState(
    draftData.customerEmail || ""
  );
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      listingId: string;
      listingName: string;
      listingImageUrl: string | null;
      variantId: string;
      variantTitle: string;
      variantImageUrl: string | null;
      sku: string | null;
      price: string | null;
      currency: string | null;
      available: number;
    }>
  >([]);
  const [searching, setSearching] = useState(false);

  const handleQuantityChange = useCallback(
    async (itemId: string, newQuantity: number) => {
      if (newQuantity < 1) {
        return;
      }

      const updatedItems = draftData.items.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );

      // Update local state optimistically
      const updatedDraftData = {
        ...draftData,
        items: updatedItems.map((item) => ({
          ...item,
          lineSubtotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
          lineTotal: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
        })),
      };

      const newSubtotal = updatedDraftData.items.reduce(
        (sum, item) => sum + parseFloat(item.lineSubtotal),
        0
      );
      const discount = parseFloat(draftData.discountAmount);
      const shipping = parseFloat(draftData.shippingAmount);
      const tax = parseFloat(draftData.taxAmount);
      const newTotal = newSubtotal - discount + shipping + tax;

      updatedDraftData.subtotalAmount = newSubtotal.toFixed(2);
      updatedDraftData.totalAmount = newTotal.toFixed(2);

      setDraftData(updatedDraftData);

      // Update on server
      setLoading(true);
      try {
        const result = await updateDraftOrderItems(
          draftData.id,
          updatedItems.map((item) => ({
            id: item.id,
            listingId: item.listingId!,
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        );

        if (result.success) {
          // Refresh draft data
          const refreshResult = await getDraftOrder(draftData.id);
          if (refreshResult.success && refreshResult.data) {
            setDraftData(refreshResult.data);
          }
        } else {
          toast.error(result.error || "Failed to update item quantity");
          // Revert to original
          setDraftData(draftData);
        }
      } catch {
        toast.error("Failed to update item quantity");
        setDraftData(draftData);
      } finally {
        setLoading(false);
      }
    },
    [draftData]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      const updatedItems = draftData.items.filter((item) => item.id !== itemId);

      // Update local state optimistically
      const updatedDraftData = {
        ...draftData,
        items: updatedItems,
      };

      const newSubtotal = updatedItems.reduce(
        (sum, item) => sum + parseFloat(item.lineSubtotal),
        0
      );
      const discount = parseFloat(draftData.discountAmount);
      const shipping = parseFloat(draftData.shippingAmount);
      const tax = parseFloat(draftData.taxAmount);
      const newTotal = newSubtotal - discount + shipping + tax;

      updatedDraftData.subtotalAmount = newSubtotal.toFixed(2);
      updatedDraftData.totalAmount = newTotal.toFixed(2);

      setDraftData(updatedDraftData);

      // Update on server
      setLoading(true);
      try {
        const result = await updateDraftOrderItems(
          draftData.id,
          updatedItems.map((item) => ({
            id: item.id,
            listingId: item.listingId!,
            variantId: item.variantId,
            quantity: item.quantity,
          }))
        );

        if (result.success) {
          toast.success("Item removed");
          // Refresh draft data
          const refreshResult = await getDraftOrder(draftData.id);
          if (refreshResult.success && refreshResult.data) {
            setDraftData(refreshResult.data);
          }
        } else {
          toast.error(result.error || "Failed to remove item");
          // Revert to original
          setDraftData(draftData);
        }
      } catch {
        toast.error("Failed to remove item");
        setDraftData(draftData);
      } finally {
        setLoading(false);
      }
    },
    [draftData]
  );

  const handleSearchProducts = useCallback(async () => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await searchProductsForOrder(productSearch, "all", 1, 20);
      if (result.success && result.data) {
        setSearchResults(result.data);
      } else {
        toast.error(result.error || "Failed to search products");
      }
    } catch {
      toast.error("Failed to search products");
    } finally {
      setSearching(false);
    }
  }, [productSearch]);

  const handleAddProduct = useCallback(
    async (product: (typeof searchResults)[0]) => {
      const existingItem = draftData.items.find(
        (item) => item.variantId === product.variantId
      );

      if (existingItem) {
        // Increase quantity
        await handleQuantityChange(existingItem.id, existingItem.quantity + 1);
      } else {
        // Add new item
        const newItems = [
          ...draftData.items,
          {
            id: `temp-${Date.now()}`,
            listingId: product.listingId,
            variantId: product.variantId,
            title: `${product.listingName} - ${product.variantTitle}`,
            sku: product.sku,
            quantity: 1,
            unitPrice: product.price || "0",
            lineSubtotal: product.price || "0",
            lineTotal: product.price || "0",
            currency: product.currency || draftData.currency,
            imageUrl: product.variantImageUrl || product.listingImageUrl,
          },
        ];

        setLoading(true);
        try {
          const result = await updateDraftOrderItems(
            draftData.id,
            newItems.map((item) => ({
              listingId: item.listingId!,
              variantId: item.variantId,
              quantity: item.quantity,
            }))
          );

          if (result.success) {
            toast.success("Product added");
            setShowAddProductDialog(false);
            setProductSearch("");
            setSearchResults([]);
            // Refresh draft data
            const refreshResult = await getDraftOrder(draftData.id);
            if (refreshResult.success && refreshResult.data) {
              setDraftData(refreshResult.data);
            }
          } else {
            toast.error(result.error || "Failed to add product");
          }
        } catch {
          toast.error("Failed to add product");
        } finally {
          setLoading(false);
        }
      }
    },
    [draftData, handleQuantityChange]
  );

  const handleSendInvoice = useCallback(async () => {
    if (!invoiceEmail.trim()) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvoice(
        draftData.id,
        invoiceEmail,
        invoiceMessage || undefined
      );

      if (result.success) {
        toast.success("Invoice sent");
        setShowSendInvoiceDialog(false);
        setInvoiceMessage("");
      } else {
        toast.error(result.error || "Failed to send invoice");
      }
    } catch {
      toast.error("Failed to send invoice");
    } finally {
      setLoading(false);
    }
  }, [draftData.id, invoiceEmail, invoiceMessage]);

  const handleMarkAsPaid = useCallback(async () => {
    setLoading(true);
    try {
      const result = await completeDraftOrder(draftData.id, true);

      if (result.success) {
        toast.success("Draft order completed and marked as paid");
        // Redirect to the regular order page
        router.push(`/dashboard/orders/${draftData.id}`);
      } else {
        toast.error(result.error || "Failed to mark as paid");
      }
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setLoading(false);
    }
  }, [draftData.id, router]);

  const handleDuplicate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await duplicateDraftOrder(draftData.id);

      if (result.success && result.newDraftId) {
        toast.success("Draft order duplicated");
        router.push(`/dashboard/draft_orders/${result.newDraftId}`);
      } else {
        toast.error(result.error || "Failed to duplicate draft order");
      }
    } catch {
      toast.error("Failed to duplicate draft order");
    } finally {
      setLoading(false);
    }
  }, [draftData.id, router]);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    try {
      const result = await deleteDraftOrders([draftData.id]);

      if (result.success) {
        toast.success("Draft order deleted");
        router.push("/dashboard/draft_orders");
      } else {
        toast.error(result.error || "Failed to delete draft order");
      }
    } catch {
      toast.error("Failed to delete draft order");
    } finally {
      setLoading(false);
    }
  }, [draftData.id, router]);

  const totalAmount = parseFloat(draftData.totalAmount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/draft_orders")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              Draft Order #{draftData.draftNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {draftData.customerEmail || "No customer email"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDuplicate}
            disabled={loading}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading}>
                <MoreVertical className="h-4 w-4 mr-2" />
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete draft order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Products</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddProductDialog(true)}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {draftData.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products in this draft order
                </div>
              ) : (
                <div className="space-y-4">
                  {draftData.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          width={60}
                          height={60}
                          className="rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{item.title}</h4>
                        {item.sku && (
                          <p className="text-sm text-muted-foreground">
                            SKU: {item.sku}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            handleQuantityChange(item.id, item.quantity - 1)
                          }
                          disabled={loading || item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            handleQuantityChange(item.id, item.quantity + 1)
                          }
                          disabled={loading}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {draftData.currency}{" "}
                          {(parseFloat(item.unitPrice) * item.quantity).toFixed(
                            2
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PaymentSummary
                orderData={{
                  currency: draftData.currency,
                  subtotalAmount: draftData.subtotalAmount,
                  discountAmount: draftData.discountAmount,
                  shippingAmount: draftData.shippingAmount,
                  taxAmount: draftData.taxAmount,
                  totalAmount: draftData.totalAmount,
                  paymentStatus: draftData.paymentStatus,
                }}
                userRole={userRole}
              />
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowSendInvoiceDialog(true)}
                  disabled={loading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send invoice
                </Button>
                <Button
                  onClick={() => setShowMarkAsPaidDialog(true)}
                  disabled={loading || draftData.paymentStatus === "paid"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Invoice Dialog */}
      <Dialog
        open={showSendInvoiceDialog}
        onOpenChange={setShowSendInvoiceDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>
              Send an invoice to the customer for this draft order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invoice-email">Email</Label>
              <Input
                id="invoice-email"
                type="email"
                value={invoiceEmail}
                onChange={(e) => setInvoiceEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <Label htmlFor="invoice-message">Message (optional)</Label>
              <Textarea
                id="invoice-message"
                value={invoiceMessage}
                onChange={(e) => setInvoiceMessage(e.target.value)}
                placeholder="Add a custom message to the invoice..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSendInvoiceDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendInvoice} disabled={loading}>
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog
        open={showMarkAsPaidDialog}
        onOpenChange={setShowMarkAsPaidDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Mark this order as paid if you received {draftData.currency}{" "}
              {totalAmount.toFixed(2)} from another payment method. This will
              create an order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMarkAsPaidDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={loading}>
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft order? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog
        open={showAddProductDialog}
        onOpenChange={setShowAddProductDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Search for a product to add to this draft order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchProducts();
                  }
                }}
              />
              <Button onClick={handleSearchProducts} disabled={searching}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {searchResults.map((product) => (
                  <div
                    key={`${product.listingId}-${product.variantId}`}
                    className="flex items-center gap-4 p-3 border rounded-lg hover:bg-secondary cursor-pointer"
                    onClick={() => handleAddProduct(product)}
                  >
                    {(product.variantImageUrl || product.listingImageUrl) && (
                      <Image
                        src={
                          product.variantImageUrl ||
                          product.listingImageUrl ||
                          ""
                        }
                        alt={product.listingName}
                        width={50}
                        height={50}
                        className="rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {product.listingName} - {product.variantTitle}
                      </h4>
                      {product.sku && (
                        <p className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {product.currency} {product.price || "0.00"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {product.available} available
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddProductDialog(false);
                setProductSearch("");
                setSearchResults([]);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
