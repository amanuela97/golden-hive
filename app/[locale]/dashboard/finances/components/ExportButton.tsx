"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportTransactionsAsCSV } from "@/app/[locale]/actions/finances";
import toast from "react-hot-toast";

interface ExportButtonProps {
  filters?: {
    type?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  };
}

export function ExportButton({ filters }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportTransactionsAsCSV(filters);

      if (result.success && result.data) {
        // Create blob and download
        const blob = new Blob([result.data], {
          type: "text/csv;charset=utf-8;",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || "transactions.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success("Transactions exported successfully");
      } else {
        toast.error(result.error || "Failed to export transactions");
      }
    } catch (error) {
      toast.error("An error occurred while exporting");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline">
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
