"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

interface PayoutRow {
  id: string;
  storeId: string;
  storeName: string;
  amount: number;
  currency: string;
  esewaIdMasked: string | null;
  hasEsewaId: boolean;
  bankAccountMasked: string | null;
  hasBankDetails: boolean;
  requestedAt: string;
}

export function EsewaPayoutsClient() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [revealedEsewa, setRevealedEsewa] = useState<Record<string, string>>({});
  const [revealedBank, setRevealedBank] = useState<Record<string, string>>({});
  const [completeDialog, setCompleteDialog] = useState<{
    payoutId: string;
    hasEsewa: boolean;
    hasBank: boolean;
  } | null>(null);
  const [completeMethod, setCompleteMethod] = useState<"esewa" | "bank" | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payouts/pending-esewa");
      const data = await res.json();
      if (data.success && data.payouts) {
        setPayouts(data.payouts);
        setRevealedEsewa({});
        setRevealedBank({});
      } else {
        toast.error(data.error || "Failed to load");
      }
    } catch {
      toast.error("Failed to load pending eSewa payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleRevealEsewa = async (payoutId: string) => {
    if (revealedEsewa[payoutId]) {
      setRevealedEsewa((prev) => ({ ...prev, [payoutId]: undefined! }));
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/payouts/${payoutId}/reveal?type=esewa`
      );
      const data = await res.json();
      if (data.esewaId != null) {
        setRevealedEsewa((prev) => ({ ...prev, [payoutId]: data.esewaId }));
      } else {
        toast.error("No eSewa ID");
      }
    } catch {
      toast.error("Failed to load eSewa ID");
    }
  };

  const handleRevealBank = async (payoutId: string) => {
    if (revealedBank[payoutId]) {
      setRevealedBank((prev) => ({ ...prev, [payoutId]: undefined! }));
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/payouts/${payoutId}/reveal?type=bank`
      );
      const data = await res.json();
      if (data.bankDetails) {
        const line =
          `${data.bankDetails.accountHolderName}, ${data.bankDetails.bankName}` +
          (data.bankDetails.branchName ? `, ${data.bankDetails.branchName}` : "") +
          ` — ${data.bankDetails.accountNumber}`;
        setRevealedBank((prev) => ({ ...prev, [payoutId]: line }));
      } else {
        toast.error("No bank details");
      }
    } catch {
      toast.error("Failed to load bank details");
    }
  };

  const handleMarkCompleted = async (payoutId: string, deliveryMethod?: "esewa" | "bank") => {
    setCompleteDialog(null);
    setCompletingId(payoutId);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliveryMethod ? { deliveryMethod } : {}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payout marked completed");
        setPayouts((prev) => prev.filter((p) => p.id !== payoutId));
      } else {
        toast.error(data.error || "Failed to mark completed");
      }
    } catch {
      toast.error("Failed to mark completed");
    } finally {
      setCompletingId(null);
    }
  };

  const openCompleteDialog = (p: PayoutRow) => {
    if (p.hasEsewaId && p.hasBankDetails) {
      setCompleteDialog({
        payoutId: p.id,
        hasEsewa: true,
        hasBank: true,
      });
      setCompleteMethod(null);
    } else {
      handleMarkCompleted(p.id);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending eSewa Payouts</CardTitle>
          <CardDescription>
            Send the amount from the platform eSewa account to each seller&apos;s
            eSewa ID, then mark as completed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No pending eSewa payouts.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Store</th>
                    <th className="text-left py-2 font-medium">Amount</th>
                    <th className="text-left py-2 font-medium">eSewa ID</th>
                    <th className="text-left py-2 font-medium">Bank</th>
                    <th className="text-left py-2 font-medium">Requested</th>
                    <th className="text-right py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2">{p.storeName}</td>
                      <td className="py-2">
                        {p.amount} {p.currency}
                      </td>
                      <td className="py-2 font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <span>{revealedEsewa[p.id] ?? (p.esewaIdMasked ?? "—")}</span>
                          {p.hasEsewaId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleRevealEsewa(p.id)}
                              title={revealedEsewa[p.id] ? "Hide" : "Show eSewa ID"}
                            >
                              {revealedEsewa[p.id] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 font-mono text-sm">
                        <div className="flex items-center gap-1">
                          <span>{revealedBank[p.id] ?? (p.bankAccountMasked ?? "—")}</span>
                          {p.hasBankDetails && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => handleRevealBank(p.id)}
                              title={revealedBank[p.id] ? "Hide" : "Show bank details"}
                            >
                              {revealedBank[p.id] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(p.requestedAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={completingId === p.id}
                          onClick={() => openCompleteDialog(p)}
                        >
                          {completingId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Mark completed"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && payouts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchPayouts}
            >
              Refresh
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!completeDialog} onOpenChange={(open) => !open && setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payout method used</DialogTitle>
            <DialogDescription>
              This seller has both eSewa ID and bank details. Select which method you used to complete the payout.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 py-2">
            <Button
              variant={completeMethod === "esewa" ? "default" : "outline"}
              onClick={() => setCompleteMethod("esewa")}
            >
              eSewa
            </Button>
            <Button
              variant={completeMethod === "bank" ? "default" : "outline"}
              onClick={() => setCompleteMethod("bank")}
            >
              Bank
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!completeMethod}
              onClick={() =>
                completeDialog && completeMethod && handleMarkCompleted(completeDialog.payoutId, completeMethod)
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
