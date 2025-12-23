"use client";

import React, { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Plus } from "lucide-react";
import type { DiscountWithDetails } from "../../actions/discounts";
import {
  deleteDiscount,
  toggleDiscountStatus,
  duplicateDiscount,
} from "../../actions/discounts";
import toast from "react-hot-toast";

interface DiscountsPageClientProps {
  discounts: DiscountWithDetails[];
  isAdmin: boolean;
}

export default function DiscountsPageClient({
  discounts,
  isAdmin,
}: DiscountsPageClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this discount?")) {
      return;
    }

    setIsDeleting(id);
    const result = await deleteDiscount(id);
    setIsDeleting(null);

    if (result.success) {
      toast.success("Discount deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete discount");
    }
  };

  const handleToggleStatus = async (id: string) => {
    const result = await toggleDiscountStatus(id);
    if (result.success) {
      toast.success("Discount status updated");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update discount status");
    }
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicateDiscount(id);
    if (result.success) {
      toast.success("Discount duplicated successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to duplicate discount");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      scheduled: "secondary",
      expired: "destructive",
      disabled: "outline",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (discounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-foreground mb-2">
          No discounts yet
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Create discounts to promote products and increase sales.
        </p>
        <Button onClick={() => router.push("/dashboard/discounts/new/amount-off-products")}>
          <Plus className="h-4 w-4 mr-2" />
          Create discount
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => router.push("/dashboard/discounts/new/amount-off-products")}>
          <Plus className="h-4 w-4 mr-2" />
          Create discount
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Active dates</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.map((discount) => (
              <TableRow
                key={discount.id}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/discounts/${discount.id}`)}
              >
                <TableCell className="font-medium">{discount.name}</TableCell>
                <TableCell>Amount off products</TableCell>
                <TableCell>{discount.appliesTo}</TableCell>
                <TableCell>{getStatusBadge(discount.status)}</TableCell>
                <TableCell>{discount.usage}</TableCell>
                <TableCell>{discount.activeDates}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/discounts/${discount.id}`)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(discount.id)}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(discount.id)}
                      >
                        {discount.isActive ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => handleDelete(discount.id)}
                          disabled={isDeleting === discount.id}
                          className="text-destructive"
                        >
                          {isDeleting === discount.id ? "Deleting..." : "Delete"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

