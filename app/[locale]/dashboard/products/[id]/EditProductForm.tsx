"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import ProductForm from "../../components/shared/ProductForm";
import { adminUpdateProductAction } from "../../../actions/products";
import { type UpdateListingData, type CreateListingData } from "@/lib/listing";
import { Listing } from "@/db/schema";
import toast from "react-hot-toast";

interface EditProductFormProps {
  initialData: Listing;
  initialVariants?: Array<{
    id: string;
    title: string;
    sku: string | null;
    price: string | null;
    currency: string | null;
    compareAtPrice: string | null;
    imageUrl: string | null;
    options: Record<string, string> | null;
    inventoryItemId: string | null;
    costPerItem: string | null;
    locationId: string | null;
    available: number | null;
    committed: number | null;
    incoming: number | null;
  }>;
  isAdmin: boolean;
}

export default function EditProductForm({
  initialData,
  initialVariants = [],
  isAdmin,
}: EditProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (data: CreateListingData | UpdateListingData) => {
    setIsLoading(true);
    try {
      // Since we're in edit mode, we know the data should be UpdateListingData
      if ("id" in data) {
        const result = await adminUpdateProductAction(
          data as UpdateListingData
        );

        if (result.success) {
          toast.success("Product updated successfully");
          router.push("/dashboard/products");
        } else {
          toast.error(result.error || "Failed to update product");
        }
      } else {
        throw new Error("Invalid data for edit operation");
      }
    } catch (error) {
      toast.error("Failed to update product");
      console.error("Update product error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProductForm
      mode="edit"
      initialData={initialData}
      initialVariants={initialVariants}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      basePath="/dashboard"
      isAdmin={isAdmin}
    />
  );
}
