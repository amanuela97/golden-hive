"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductForm from "../../../components/shared/ProductForm";
import { adminUpdateProductAction } from "@/app/actions/products";
import { type UpdateListingData, type CreateListingData } from "@/lib/listing";
import { Listing } from "@/db/schema";
import toast from "react-hot-toast";

interface EditProductFormProps {
  initialData: Listing;
}

export default function EditProductForm({ initialData }: EditProductFormProps) {
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
          router.push("/dashboard/admin/products");
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
      onSubmit={handleSubmit}
      isLoading={isLoading}
      basePath="/dashboard/admin"
      isAdmin={true}
    />
  );
}
