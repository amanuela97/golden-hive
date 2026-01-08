"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { processRefundRequest } from "@/app/[locale]/actions/orders";
import {
  listRefundRequests,
  type RefundRequestRow,
} from "@/app/[locale]/actions/refund-requests";
import toast from "react-hot-toast";
import { useRouter } from "@/i18n/navigation";

interface RefundRequestsPageClientProps {
  initialData: RefundRequestRow[];
}

export default function RefundRequestsPageClient({
  initialData,
}: RefundRequestsPageClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selectedRequest, setSelectedRequest] =
    useState<RefundRequestRow | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [feePaidBy, setFeePaidBy] = useState<"platform" | "seller">("seller");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleRefresh = async () => {
    const result = await listRefundRequests();
    if (result.success && result.data) {
      setData(result.data);
    }
  };

  const handleReview = (request: RefundRequestRow) => {
    setSelectedRequest(request);
    setAction("approve");
    setFeePaidBy("seller");
    setRejectionReason("");
    setShowReviewDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedRequest) return;

    if (action === "reject" && !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      const result = await processRefundRequest(
        selectedRequest.id,
        action,
        feePaidBy,
        action === "reject" ? rejectionReason : undefined
      );

      if (result.success) {
        toast.success(
          action === "approve"
            ? "Refund request approved and processed"
            : "Refund request rejected"
        );
        setShowReviewDialog(false);
        setSelectedRequest(null);
        handleRefresh();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to process refund request");
      }
    } catch (error) {
      toast.error("Failed to process refund request");
      console.error("Process refund request error:", error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || colors.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    };
    return labels[status] || status;
  };

  const pendingRequests = data.filter((r) => r.status === "pending");
  const otherRequests = data.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Refund Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review and process customer refund requests
          </p>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests ({pendingRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/orders/${request.orderId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {request.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.customerName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.customerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium">{request.reason}</div>
                        {request.description && (
                          <div className="text-sm text-muted-foreground mt-1 truncate">
                            {request.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {parseFloat(request.totalAmount).toFixed(2)}{" "}
                      {request.currency}
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusColor(request.status)}
                      >
                        {getStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReview(request)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Other Requests */}
      {otherRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Requests ({otherRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/orders/${request.orderId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {request.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.customerName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.customerEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="font-medium">{request.reason}</div>
                        {request.description && (
                          <div className="text-sm text-muted-foreground mt-1 truncate">
                            {request.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {parseFloat(request.totalAmount).toFixed(2)}{" "}
                      {request.currency}
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusColor(request.status)}
                      >
                        {getStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.reviewedAt
                        ? format(new Date(request.reviewedAt), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No refund requests found.</p>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve" : "Reject"} Refund Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  Review refund request for Order #{selectedRequest.orderNumber}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {selectedRequest.customerName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reason:</span>
                  <span className="font-medium">{selectedRequest.reason}</span>
                </div>
                {selectedRequest.description && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Details: </span>
                    {selectedRequest.description}
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {parseFloat(selectedRequest.totalAmount).toFixed(2)}{" "}
                    {selectedRequest.currency}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={action}
                  onValueChange={(value) =>
                    setAction(value as "approve" | "reject")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">Approve Refund</SelectItem>
                    <SelectItem value="reject">Reject Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {action === "approve" && (
                <div className="space-y-2">
                  <Label>Who pays Stripe fee?</Label>
                  <Select
                    value={feePaidBy}
                    onValueChange={(value) =>
                      setFeePaidBy(value as "platform" | "seller")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seller">Seller</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Stripe processing fees are not refundable. Choose who
                    absorbs the cost.
                  </p>
                </div>
              )}

              {action === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection reason *</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Please provide a reason for rejecting this refund request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={action === "approve" ? "default" : "destructive"}
              onClick={handleSubmit}
              disabled={
                processing || (action === "reject" && !rejectionReason.trim())
              }
            >
              {processing
                ? "Processing..."
                : action === "approve"
                  ? "Approve & Process Refund"
                  : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
