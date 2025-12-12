"use client";

import React, { useState, useCallback } from "react";
import type { Listing } from "@/db/schema";
import ProductTable from "./ProductTable";
import ImportExportButtons from "./ImportExportButtons";
import {
  deleteProductAction,
  toggleProductStatusAction,
  toggleProductFeaturedAction,
} from "../../../actions/products";

interface ProductsPageClientProps {
  products: (Listing & { variantCount?: number; totalStock?: number })[];
  basePath: string; // e.g., "/dashboard/admin" or "/dashboard/seller"
  isAdmin?: boolean; // Whether current user is admin
}

export default function ProductsPageClient({
  products,
  basePath,
  isAdmin = false,
}: ProductsPageClientProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedProductIds(selectedIds);
  }, []);

  const handleImportComplete = useCallback(() => {
    // Refresh the page to show updated data
    window.location.reload();
  }, []);

  return (
    <div className="space-y-6">
      {/* Import/Export Section */}
      <ImportExportButtons
        selectedProductIds={selectedProductIds}
        onImportComplete={handleImportComplete}
      />

      {/* Products Table */}
      <ProductTable
        products={products}
        onDelete={deleteProductAction}
        onToggleStatus={toggleProductStatusAction}
        onToggleFeatured={toggleProductFeaturedAction}
        onSelectionChange={handleSelectionChange}
        basePath={basePath}
        isAdmin={isAdmin}
      />
    </div>
  );
}
