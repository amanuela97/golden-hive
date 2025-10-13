"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductForm from "../components/ProductForm";
import { createProductAction } from "@/app/actions/products";
import { type CreateListingData, type UpdateListingData } from "@/lib/listing";
import toast from "react-hot-toast";

export default function NewProductForm() {
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
    <ProductForm mode="create" onSubmit={handleSubmit} isLoading={isLoading} />
  );
}
