import type React from "react";
import {
  Home,
  ShoppingCart,
  Package,
  FileText,
  Users,
  Globe,
  Percent,
  Store,
  Wallet,
} from "lucide-react";
import {
  Users as UsersIcon,
  Shield,
  Key,
  Image as ImageIcon,
  Languages,
  Tag,
  MessageSquare,
  CreditCard,
  User,
  Truck,
  Package as PackageIcon,
} from "lucide-react";

export type UserRole = "admin" | "seller" | "customer";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    label: string;
    href: string;
  }[];
  roles?: UserRole[];
}

export interface SettingsSectionConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  href?: string;
}

export const allNavItems: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: Home,
    roles: ["admin", "seller", "customer"],
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingCart,
    children: [
      { label: "Drafts", href: "/dashboard/draft_orders" },
      { label: "Refund Requests", href: "/dashboard/orders/refund-requests" },
    ],
    roles: ["admin", "seller", "customer"],
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    roles: ["admin", "seller", "customer"],
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    roles: ["admin", "seller"],
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: Package,
    children: [{ label: "Inventory", href: "/dashboard/inventory" }],
    roles: ["admin", "seller"],
  },
  {
    label: "Discounts",
    href: "/dashboard/discounts",
    icon: Percent,
    roles: ["admin", "seller"],
  },
  {
    label: "Documentation",
    href: "/dashboard/documentation",
    icon: FileText,
    roles: ["admin", "seller"],
  },
  {
    label: "Markets",
    href: "/dashboard/markets",
    icon: Globe,
    roles: ["admin", "seller"],
  },
  {
    label: "Stores",
    href: "/dashboard/stores",
    icon: Store,
    roles: ["admin"],
  },
  {
    label: "Finances",
    href: "/dashboard/finances/payouts",
    icon: Wallet,
    children: [
      { label: "Balance & Payouts", href: "/dashboard/finances/payouts" },
      {
        label: "Transaction History",
        href: "/dashboard/finances/transactions",
      },
      { label: "eSewa Payouts (Admin)", href: "/dashboard/finances/esewa-payouts" },
    ],
    roles: ["admin", "seller"],
  },
];

export const settingsSections: SettingsSectionConfig[] = [
  {
    id: "store",
    label: "Store",
    icon: Store,
    roles: ["admin", "seller"],
  },
  {
    id: "users",
    label: "Users",
    icon: UsersIcon,
    roles: ["admin"],
  },
  {
    id: "roles",
    label: "Roles",
    icon: Shield,
    roles: ["admin"],
  },
  {
    id: "permissions",
    label: "Permissions",
    icon: Key,
    roles: ["admin"],
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    roles: ["admin", "seller", "customer"],
  },
  {
    id: "account",
    label: "Account & Security",
    icon: Shield,
    roles: ["admin", "seller", "customer"],
  },
  {
    id: "contents",
    label: "Contents",
    icon: ImageIcon,
    roles: ["admin"],
    href: "/dashboard/content",
  },
  {
    id: "translations",
    label: "Translations",
    icon: Languages,
    roles: ["admin"],
  },
  {
    id: "categories",
    label: "Categories",
    icon: Tag,
    roles: ["admin"],
  },
  {
    id: "feedbacks",
    label: "Feedbacks",
    icon: MessageSquare,
    roles: ["admin"],
  },
  {
    id: "communications",
    label: "Communications",
    icon: MessageSquare,
    roles: ["admin"],
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["admin", "seller"],
  },
  {
    id: "shipping-billing",
    label: "Shipping & Billing",
    icon: Truck,
    roles: ["admin", "seller", "customer"],
  },
  {
    id: "shipping-settings",
    label: "Shipping Settings",
    icon: PackageIcon,
    roles: ["admin", "seller"],
  },
];

/**
 * Normalize pathname by removing locale prefix
 */
function normalizePathname(pathname: string): string {
  // Remove locale prefix if present (e.g., /en/dashboard -> /dashboard)
  const normalized = pathname.replace(/^\/(en|fi|ne)/, "");
  return normalized || pathname;
}

/**
 * Check if a route is accessible to a user role based on navigation config
 */
export function isRouteAccessible(
  pathname: string,
  userRole: UserRole
): boolean {
  // Normalize pathname to remove locale prefix
  const normalizedPath = normalizePathname(pathname);

  // Check settings routes FIRST - they are more specific than main nav items
  // This prevents /dashboard/settings/* from matching the /dashboard nav item
  if (normalizedPath.startsWith("/dashboard/settings/")) {
    const section = normalizedPath
      .split("/dashboard/settings/")[1]
      ?.split("/")[0];
    if (section) {
      const settingsSection = settingsSections.find((s) => s.id === section);
      if (settingsSection) {
        // If section has roles defined, check if user role is included
        if (settingsSection.roles) {
          const hasAccess = settingsSection.roles.includes(userRole);

          return hasAccess;
        }
        // If no roles defined, allow access (shouldn't happen but handle gracefully)
        return true;
      }
      // If section not found in config, deny access (show 404)
      // This prevents access to non-existent or restricted sections
      console.log("isRouteAccessible - settings section not found:", section);
      return false;
    }
    // If no section extracted, deny access for safety
    console.log(
      "isRouteAccessible - no section extracted from:",
      normalizedPath
    );
    return false;
  }

  // Check main nav items (after settings routes to avoid conflicts)
  for (const item of allNavItems) {
    // Check if pathname matches the item href exactly or is a child route
    if (
      normalizedPath === item.href ||
      normalizedPath.startsWith(item.href + "/")
    ) {
      // If item has roles, check if user role is included
      if (item.roles && !item.roles.includes(userRole)) {
        return false;
      }

      // Check children if pathname is a child route
      if (item.children) {
        for (const child of item.children) {
          if (
            normalizedPath === child.href ||
            normalizedPath.startsWith(child.href + "/")
          ) {
            // Drafts are only for admin and seller
            if (child.href === "/dashboard/draft_orders") {
              return userRole === "admin" || userRole === "seller";
            }
            // New order creation is only for admin and seller
            if (child.href === "/dashboard/orders/new") {
              return userRole === "admin" || userRole === "seller";
            }
            // Refund Requests are only for admin and seller
            if (child.href === "/dashboard/orders/refund-requests") {
              return userRole === "admin" || userRole === "seller";
            }
            // Other children inherit parent permissions
            return item.roles ? item.roles.includes(userRole) : true;
          }
        }
      }

      return true;
    }
  }

  // Default: allow access if not in restricted list
  // This allows for pages that aren't in the nav but should be accessible
  return true;
}

/**
 * Get all restricted routes for a role (routes that should show 404)
 */
export function getRestrictedRoutes(userRole: UserRole): string[] {
  const restricted: string[] = [];

  // Check nav items
  for (const item of allNavItems) {
    if (item.roles && !item.roles.includes(userRole)) {
      restricted.push(item.href);
      // Add child routes
      if (item.children) {
        for (const child of item.children) {
          restricted.push(child.href);
        }
      }
    } else if (item.children) {
      // Check children individually
      for (const child of item.children) {
        if (child.href === "/dashboard/draft_orders") {
          if (userRole === "customer") {
            restricted.push(child.href);
          }
        }
        if (child.href === "/dashboard/orders/refund-requests") {
          if (userRole === "customer") {
            restricted.push(child.href);
          }
        }
      }
    }
  }

  // Check settings sections
  for (const section of settingsSections) {
    if (section.roles && !section.roles.includes(userRole)) {
      restricted.push(`/dashboard/settings/${section.id}`);
    }
  }

  return restricted;
}
