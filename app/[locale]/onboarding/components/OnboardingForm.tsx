"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserRole } from "@/lib/roles";
import { completeOnboarding } from "../../actions/auth";
import toast from "react-hot-toast";
import { ShoppingCart, Store, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function OnboardingForm() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [storeName, setStoreName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("onboarding");

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      toast.error(t("pleaseSelectRole"));
      return;
    }

    // Validate store name if Seller role is selected
    if (selectedRole === UserRole.SELLER && !storeName.trim()) {
      toast.error("Please enter a store name");
      return;
    }

    setIsLoading(true);
    try {
      const result = await completeOnboarding(
        selectedRole,
        selectedRole === UserRole.SELLER ? storeName.trim() : undefined
      );

      if (result.success) {
        toast.success(t("profileCompletedSuccess"));
        router.push(`/dashboard/${selectedRole.toLowerCase()}`);
      } else {
        toast.error(result.error || t("failedCompleteProfile"));
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(t("failedCompleteProfile"));
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    {
      value: UserRole.CUSTOMER,
      title: t("customer"),
      description: t("customerDescription"),
      icon: ShoppingCart,
    },
    {
      value: UserRole.SELLER,
      title: t("seller"),
      description: t("sellerDescription"),
      icon: Store,
    },
  ];

  return (
    <div className="space-y-6 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Creating store...
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <Card
              key={role.value}
              className={`cursor-pointer transition-all ${
                selectedRole === role.value
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
              onClick={() => !isLoading && setSelectedRole(role.value)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Icon className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{role.title}</CardTitle>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Store name input for Seller role */}
      {selectedRole === UserRole.SELLER && (
        <div className="space-y-2">
          <Label htmlFor="storeName" className="text-sm font-medium">
            Store Name *
          </Label>
          <Input
            id="storeName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Enter your store name"
            required
            className="h-11"
            disabled={isLoading}
          />
        </div>
      )}

      <Button
        onClick={handleRoleSelection}
        disabled={!selectedRole || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? t("completing") : t("continue")}
      </Button>
    </div>
  );
}
