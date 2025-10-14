"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Shield, CreditCard, Truck } from "lucide-react";
import ProfileTab from "./settings/ProfileTab";
import SecurityTab from "./settings/SecurityTab";
import PaymentsTab from "./settings/PaymentsTab";
import ShippingTab from "./settings/ShippingTab";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCredential: boolean;
}

type TabType = "profile" | "security" | "payments" | "shipping";

export default function SettingsModal({
  isOpen,
  onClose,
  isCredential,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  if (!isOpen) return null;

  const tabs = [
    {
      id: "profile" as TabType,
      label: "Profile",
      icon: User,
      component: <ProfileTab />,
    },
    {
      id: "security" as TabType,
      label: "Account & Security",
      icon: Shield,
      component: <SecurityTab isCredential={isCredential} />,
    },
    {
      id: "payments" as TabType,
      label: "Payments & Payouts",
      icon: CreditCard,
      component: <PaymentsTab />,
    },
    {
      id: "shipping" as TabType,
      label: "Shipping & Delivery",
      icon: Truck,
      component: <ShippingTab />,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="text-2xl font-bold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-64 border-r bg-gray-50 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {tabs.find((tab) => tab.id === activeTab)?.component}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
