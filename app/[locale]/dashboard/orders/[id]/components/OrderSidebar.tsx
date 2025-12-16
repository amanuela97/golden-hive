"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  User,
  MapPin,
  Tag,
  AlertTriangle,
  FileText,
  Edit,
  Save,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

interface OrderData {
  id: string;
  internalNote: string | null;
  notes: string | null;
  tags: string | null;
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
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
}

interface OrderSidebarProps {
  orderData: OrderData;
  userRole: "admin" | "seller" | "customer";
  customerName: string;
}

export function OrderSidebar({
  orderData,
  userRole,
  customerName,
}: OrderSidebarProps) {
  const isInternal = userRole === "admin" || userRole === "seller";
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(orderData.internalNote || "");

  const tags = orderData.tags
    ? orderData.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];

  const formatAddress = (
    line1: string | null,
    line2: string | null,
    city: string | null,
    region: string | null,
    postalCode: string | null,
    country: string | null
  ) => {
    const parts = [
      line1,
      line2,
      [city, region, postalCode].filter(Boolean).join(", "),
      country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : "No address provided";
  };

  const handleSaveNote = async () => {
    try {
      // TODO: Implement updateInternalNote server action
      toast.info("Note saving functionality coming soon");
      setEditingNote(false);
    } catch (error) {
      toast.error("Failed to save note");
    }
  };

  return (
    <div className="space-y-6">
      {/* Notes (Internal only) */}
      {isInternal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <CardTitle>Notes</CardTitle>
              </div>
              {!editingNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingNote(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingNote ? (
              <div className="space-y-2">
                <Textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  rows={4}
                  placeholder="Add internal notes..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNote}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNoteValue(orderData.internalNote || "");
                      setEditingNote(false);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {orderData.internalNote || "No notes"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Customer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm font-medium">{customerName}</p>
            {orderData.customerEmail && (
              <p className="text-sm text-muted-foreground">
                {orderData.customerEmail}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>Addresses</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Shipping Address</p>
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {orderData.shippingName && <p className="font-medium text-foreground">{orderData.shippingName}</p>}
              {orderData.shippingPhone && <p>{orderData.shippingPhone}</p>}
              {formatAddress(
                orderData.shippingAddressLine1,
                orderData.shippingAddressLine2,
                orderData.shippingCity,
                orderData.shippingRegion,
                orderData.shippingPostalCode,
                orderData.shippingCountry
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Billing Address</p>
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {orderData.billingName && <p className="font-medium text-foreground">{orderData.billingName}</p>}
              {orderData.billingPhone && <p>{orderData.billingPhone}</p>}
              {formatAddress(
                orderData.billingAddressLine1,
                orderData.billingAddressLine2,
                orderData.billingCity,
                orderData.billingRegion,
                orderData.billingPostalCode,
                orderData.billingCountry
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags (Internal only) */}
      {isInternal && tags.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              <CardTitle>Tags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Risk (Internal only - placeholder) */}
      {isInternal && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Order Risk</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Risk assessment coming soon
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

