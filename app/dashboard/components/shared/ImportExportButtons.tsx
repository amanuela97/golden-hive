"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Upload, FileText } from "lucide-react";
import {
  exportListingsToCSVAction,
  importListingsFromCSVAction,
} from "@/app/actions/products";
import toast from "react-hot-toast";

interface ImportExportButtonsProps {
  selectedProductIds: string[];
  onImportComplete?: () => void;
}

export default function ImportExportButtons({
  selectedProductIds,
  onImportComplete,
}: ImportExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportListingsToCSVAction(
        selectedProductIds.length > 0 ? selectedProductIds : undefined
      );

      if (result.success && result.csvContent) {
        // Create and download the CSV file
        const blob = new Blob([result.csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", result.filename || "listings.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const count =
          selectedProductIds.length > 0 ? selectedProductIds.length : "all";
        toast.success(`Successfully exported ${count} listings to CSV`);
      } else {
        toast.error(result.error || "Failed to export listings");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export listings");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    setIsImporting(true);
    try {
      const csvContent = await file.text();
      const result = await importListingsFromCSVAction(csvContent);

      if (result.success) {
        toast.success(
          `Successfully imported ${result.importedCount} listings${
            result?.errorCount && result.errorCount > 0
              ? ` (${result.errorCount} errors)`
              : ""
          }`
        );

        if (result.errors && result.errors.length > 0) {
          console.warn("Import errors:", result.errors);
          // Show detailed errors in console for debugging
          result.errors.forEach((error) => console.error(error));
        }

        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Notify parent component to refresh data
        if (onImportComplete) {
          onImportComplete();
        }
      } else {
        toast.error(result.error || "Failed to import listings");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import listings");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Import / Export</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isImporting ? "Importing..." : "Import CSV"}
          </Button>
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        {selectedProductIds.length > 0 ? (
          <span>Export {selectedProductIds.length} selected listings</span>
        ) : (
          <span>Export all listings</span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImport}
        className="hidden"
      />
    </Card>
  );
}
