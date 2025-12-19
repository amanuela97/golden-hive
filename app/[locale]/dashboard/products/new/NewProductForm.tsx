"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import ProductForm from "../../components/shared/ProductForm";
import { createProductAction } from "../../../actions/products";
import { type CreateListingData, type UpdateListingData } from "@/lib/listing";
import toast from "react-hot-toast";
import { SetupBannerWrapper } from "../../components/shared/SetupBannerWrapper";

interface NewProductFormProps {
  isAdmin: boolean;
}

export default function NewProductForm({ isAdmin }: NewProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (data: CreateListingData | UpdateListingData) => {
    setIsLoading(true);
    try {
      const result = await createProductAction(data as CreateListingData);

      if (result.success) {
        toast.success("Product created successfully");
        router.push("/dashboard/products");
      } else {
        toast.error(result.error || "Failed to create product");
      }
    } catch (error) {
      toast.error("Failed to create product");
      console.error("Create product error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <SetupBannerWrapper />
      <ProductForm
        mode="create"
        onSubmit={handleSubmit}
        isLoading={isLoading}
        basePath="/dashboard"
        isAdmin={isAdmin}
      />
    </div>
  );
}
