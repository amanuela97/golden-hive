"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MoreVertical,
  Copy,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  duplicateDraftOrder,
  deleteDraftOrders,
} from "@/app/[locale]/actions/draft-orders";

interface DraftOrderActionsProps {
  draftId: string;
  draftNumber: number;
  customerEmail: string | null;
  userRole: "admin" | "seller" | "customer";
  isFormModified?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  formLoading?: boolean;
  actionLoading?: boolean; // For send invoice/mark as paid actions
}

export default function DraftOrderActions({
  draftId,
  draftNumber,
  customerEmail,
  userRole,
  isFormModified = false,
  onSave,
  onCancel,
  formLoading = false,
  actionLoading = false,
}: DraftOrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDuplicate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await duplicateDraftOrder(draftId);

      if (result.success && result.newDraftId) {
        toast.success("Draft order duplicated");
        router.push(`/dashboard/draft_orders/${result.newDraftId}`);
      } else {
        toast.error(result.error || "Failed to duplicate draft order");
      }
    } catch (error) {
      toast.error("Failed to duplicate draft order");
    } finally {
      setLoading(false);
    }
  }, [draftId, router]);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    try {
      const result = await deleteDraftOrders([draftId]);

      if (result.success) {
        toast.success("Draft order deleted");
        router.push("/dashboard/draft_orders");
      } else {
        toast.error(result.error || "Failed to delete draft order");
      }
    } catch (error) {
      toast.error("Failed to delete draft order");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  }, [draftId, router]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Draft Order #{draftNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {customerEmail || "No customer email"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Save and Cancel buttons - only show when form is modified */}
          {isFormModified && (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={loading || formLoading || actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={loading || formLoading || actionLoading}
              >
                {formLoading ? "Saving..." : "Save"}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleDuplicate} disabled={loading}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading}>
                <MoreVertical className="h-4 w-4 mr-2" />
                More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete draft order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft order? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

