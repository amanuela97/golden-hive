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
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface PayoutRow {
  id: string;
  storeId: string;
  storeName: string;
  amount: number;
  currency: string;
  esewaId: string | null;
  requestedAt: string;
}

export function EsewaPayoutsClient() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payouts/pending-esewa");
      const data = await res.json();
      if (data.success && data.payouts) {
        setPayouts(data.payouts);
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

  const handleMarkCompleted = async (payoutId: string) => {
    setCompletingId(payoutId);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/complete`, {
        method: "POST",
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
                      <td className="py-2 font-mono">
                        {p.esewaId || "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(p.requestedAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={completingId === p.id}
                          onClick={() => handleMarkCompleted(p.id)}
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
    </div>
  );
}
