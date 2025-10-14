"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { CreditCard, Clock } from "lucide-react";

export default function PaymentsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-semibold">Payments & Payouts</h3>
      </div>

      <Card className="p-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-gray-100 rounded-full">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Coming Soon
            </h4>
            <p className="text-gray-600 max-w-md mx-auto">
              Payment and payout management features are currently under
              development. You&apos;ll be able to manage your payment methods,
              view transaction history, and configure payout settings here.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
