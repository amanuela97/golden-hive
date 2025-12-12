"use client";

import { useEffect, useState } from "react";
import { getAllCategoryRules } from "../../../actions/category-rules";
import CategoryManagement from "../admin/CategoryManagement";
import TranslationsPage from "../../translations/page";
import ProfileTab from "./settings/ProfileTab";
import SecurityTab from "./settings/SecurityTab";
import PaymentsTab from "./settings/PaymentsTab";
import ShippingTab from "./settings/ShippingTab";
import VendorTab from "./settings/VendorTab";
import UserManagement from "../admin/UserManagement";
import RoleManagement from "../admin/RoleManagement";
import PermissionsManagement from "../admin/PermissionsManagement";
import { useSession } from "@/lib/auth-client";
import {
  getAllFeedbacks,
  deleteFeedback,
} from "../../../actions/feedbackActions";
import { Link } from "@/i18n/navigation";
import { CategoryRules } from "@/db/schema";

type SettingsSection =
  | "users"
  | "roles"
  | "permissions"
  | "account"
  | "contents"
  | "translations"
  | "categories"
  | "feedbacks"
  | "communications"
  | "payments"
  | "policies"
  | "profile"
  | "security"
  | "shipping-billing"
  | "vendor";

interface SettingsContentProps {
  section: SettingsSection;
  userRole: "admin" | "seller" | "customer";
}

type Feedback = Awaited<ReturnType<typeof getAllFeedbacks>>[number];

export default function SettingsContent({
  section,
  userRole,
}: SettingsContentProps) {
  const { data: session } = useSession();
  const isCredential = session?.user?.emailVerified ?? false;
  const [categoryRules, setCategoryRules] = useState<CategoryRules[] | null>(
    null
  );
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true);

  useEffect(() => {
    if (section === "categories" && userRole === "admin") {
      loadCategoryRules();
    }
    if (section === "feedbacks" && userRole === "admin") {
      loadFeedbacks();
    }
  }, [section, userRole]);

  const loadCategoryRules = async () => {
    setLoadingCategories(true);
    try {
      const result = await getAllCategoryRules();
      if (result.success && result.result) {
        setCategoryRules(result.result);
      }
    } catch (error) {
      console.error("Error loading category rules:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const feedbacksData = await getAllFeedbacks();
      setFeedbacks(feedbacksData);
    } catch (error) {
      console.error("Error loading feedbacks:", error);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      const formData = new FormData();
      formData.append("id", id);
      await deleteFeedback(id);
      loadFeedbacks();
    } catch (error) {
      console.error("Error deleting feedback:", error);
    }
  };

  switch (section) {
    case "users":
      return <UserManagement />;
    case "roles":
      return <RoleManagement initialRoles={null} initialPermissions={null} />;
    case "permissions":
      return <PermissionsManagement initialPermissions={null} />;
    case "account":
    case "security":
      return <SecurityTab isCredential={isCredential} />;
    case "profile":
      return <ProfileTab />;
    case "payments":
      return <PaymentsTab />;
    case "shipping-billing":
      return <ShippingTab />;
    case "vendor":
      return <VendorTab />;
    case "translations":
      return <TranslationsPage />;
    case "categories":
      if (loadingCategories) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        );
      }
      return <CategoryManagement initialCategoryRules={categoryRules} />;
    case "feedbacks":
      if (loadingFeedbacks) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        );
      }
      return (
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Visitor Feedback</h2>
          {feedbacks.length === 0 && <p>No feedback yet.</p>}

          <ul className="space-y-4">
            {feedbacks.map((f) => (
              <li
                key={f.id}
                className="border p-4 rounded-lg bg-white shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">
                    Rating: {f.rating}/5
                  </span>
                  <button
                    onClick={() => handleDeleteFeedback(f.id)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-gray-800">{f.message}</p>
                {f.suggestions && (
                  <p className="text-gray-600 text-sm mt-2">
                    <strong>Suggestion:</strong> {f.suggestions}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {f.createdAt
                    ? new Date(f.createdAt).toLocaleString()
                    : "Unknown date"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      );
    case "contents":
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Contents management is available at{" "}
            <Link
              href="/dashboard/content"
              className="text-primary hover:underline"
            >
              /dashboard/content
            </Link>
          </p>
        </div>
      );
    case "communications":
    case "policies":
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {section} settings content will be added here
          </p>
        </div>
      );
    default:
      // Log unknown section for debugging
      console.warn("Unknown settings section:", section);
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {section} settings content will be added here
          </p>
        </div>
      );
  }
}
