"use client";

import { useState, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import DraftOrderActions from "./DraftOrderActions";
import CreateOrderForm, { type CreateOrderFormRef } from "../../orders/components/CreateOrderForm";

interface DraftOrderPageClientProps {
  draftId: string;
  draftNumber: number;
  customerEmail: string | null;
  userRole: "admin" | "seller" | "customer";
  initialData: {
    customerId: string | null;
    customerEmail: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerPhone: string | null;
    lineItems: Array<{
      id: string;
      listingId: string;
      variantId: string | null;
      quantity: number;
      unitPrice: string;
      title: string;
      sku: string | null;
      listingName: string;
      variantTitle: string;
      imageUrl?: string | null;
      variantImageUrl?: string | null;
      currency: string;
      originalCurrency: string;
      originalUnitPrice: string;
      available: number;
    }>;
    currency: string;
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
    paymentStatus: "pending" | "paid";
    marketId: string | null;
  };
}

export default function DraftOrderPageClient({
  draftId,
  draftNumber,
  customerEmail,
  userRole,
  initialData,
}: DraftOrderPageClientProps) {
  const router = useRouter();
  // Start with false to ensure buttons don't show on initial load
  const [isFormModified, setIsFormModified] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const formRef = useRef<CreateOrderFormRef>(null);

  const handleSave = () => {
    if (formRef.current) {
      formRef.current.triggerSave();
    }
  };

  const handleLoadingChange = (loading: boolean) => {
    setFormLoading(loading);
  };

  const handleCancel = () => {
    if (formRef.current) {
      formRef.current.triggerCancel();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <DraftOrderActions
        draftId={draftId}
        draftNumber={draftNumber}
        customerEmail={customerEmail}
        userRole={userRole}
        isFormModified={isFormModified}
        onSave={handleSave}
        onCancel={handleCancel}
        formLoading={formLoading}
      />

      {/* Form */}
      <CreateOrderForm
        ref={formRef}
        userRole={userRole}
        cancelRedirectPath="/dashboard/draft_orders"
        draftId={draftId}
        initialData={initialData}
        showTopButtons={true}
        onFormModified={(modified) => {
          setIsFormModified(modified);
        }}
        onLoadingChange={handleLoadingChange}
      />
    </div>
  );
}

