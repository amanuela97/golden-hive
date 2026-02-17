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
import { Link } from "@/i18n/navigation";

interface ActivityItem {
  id: string;
  date: Date;
  type: string;
  description: string;
  amount: number;
  currency: string;
  balance: number;
  orderId?: string | null;
  status?: string | null;
  availableAt?: Date | null;
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
}

const typeColors: Record<string, string> = {
  order_payment:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  platform_fee: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  esewa_fee: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  stripe_fee:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  shipping_label:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  refund: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  dispute: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  payout:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  adjustment: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const typeLabels: Record<string, string> = {
  order_payment: "Sale",
  platform_fee: "Platform Fee",
  esewa_fee: "eSewa Fee",
  stripe_fee: "Stripe Fee",
  shipping_label: "Shipping",
  refund: "Refund",
  dispute: "Dispute",
  payout: "Payout",
  adjustment: "Adjustment",
};

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No transactions yet. Your activity will appear here once you make sales.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(activity.date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    typeColors[activity.type] || "bg-gray-100 text-gray-800"
                  }
                >
                  {typeLabels[activity.type] || activity.type}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{activity.description}</span>
                  {activity.orderId && (
                    <Link
                      href={`/dashboard/orders/${activity.orderId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      #{activity.orderId.slice(0, 8)}
                    </Link>
                  )}
                </div>
              </TableCell>
              <TableCell
                className={`text-right font-medium ${
                  activity.amount >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {activity.amount >= 0 ? "+" : ""}
                {formatCurrency(activity.amount, activity.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(activity.balance, activity.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
