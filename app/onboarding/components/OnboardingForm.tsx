"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole } from "@/lib/roles";
import { completeOnboarding } from "@/app/actions/auth";
import toast from "react-hot-toast";
import { ShoppingCart, Store } from "lucide-react";

export function OnboardingForm() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }

    setIsLoading(true);
    try {
      const result = await completeOnboarding(selectedRole);
      
      if (result.success) {
        toast.success("Profile completed successfully!");
        router.push(`/dashboard/${selectedRole.toLowerCase()}`);
      } else {
        toast.error(result.error || "Failed to complete profile");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    {
      value: UserRole.CUSTOMER,
      title: "Customer",
      description: "Browse and purchase products",
      icon: ShoppingCart,
    },
    {
      value: UserRole.SELLER,
      title: "Seller", 
      description: "Create and manage product listings",
      icon: Store,
    },
  ];

  return (
    <div className="space-y-6">
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
              }`}
              onClick={() => setSelectedRole(role.value)}
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

      <Button
        onClick={handleRoleSelection}
        disabled={!selectedRole || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? "Completing..." : "Continue"}
      </Button>
    </div>
  );
}
