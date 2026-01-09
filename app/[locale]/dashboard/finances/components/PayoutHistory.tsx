"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripeTransferId?: string | null;
  requestedAt: Date;
  processedAt?: Date | null;
  completedAt?: Date | null;
  failureReason?: string | null;
}

interface PayoutHistoryProps {
  payouts: Payout[];
}

const statusColors: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function PayoutHistory({ payouts }: PayoutHistoryProps) {
  if (payouts.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No payout history yet. Your payouts will appear here once processed.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell className="whitespace-nowrap">
                {payout.completedAt
                  ? format(new Date(payout.completedAt), "MMM dd, yyyy")
                  : payout.processedAt
                    ? format(new Date(payout.processedAt), "MMM dd, yyyy")
                    : format(new Date(payout.requestedAt), "MMM dd, yyyy")}
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(payout.amount, payout.currency)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    statusColors[payout.status] || "bg-gray-100 text-gray-800"
                  }
                >
                  {payout.status.charAt(0).toUpperCase() +
                    payout.status.slice(1)}
                </Badge>
                {payout.failureReason && (
                  <p className="mt-1 text-xs text-red-600">
                    {payout.failureReason}
                  </p>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {payout.stripeTransferId || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">Manual</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
