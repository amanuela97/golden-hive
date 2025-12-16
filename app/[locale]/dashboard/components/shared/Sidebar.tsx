"use client";

import type React from "react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Settings,
  ChevronDown,
  Users,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    label: string;
    href: string;
  }[];
  roles?: ("admin" | "seller" | "customer")[];
}

const allNavItems: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: Home,
    // All roles can access Home (C, S, A)
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingCart,
    children: [{ label: "Drafts", href: "/dashboard/draft_orders" }],
    roles: ["admin", "seller", "customer"], // C, S, A
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    roles: ["admin", "seller"], // S, A
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: Package,
    children: [{ label: "Inventory", href: "/dashboard/inventory" }],
    roles: ["admin", "seller"], // S, A
  },
  {
    label: "Documentation",
    href: "/dashboard/documentation",
    icon: FileText,
    roles: ["admin", "seller"], // S, A
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    roles: ["admin", "seller"], // A, S,
  },
  {
    label: "Markets",
    href: "/dashboard/markets",
    icon: Globe,
    roles: ["admin", "seller"], // A, S
  },
];

interface SidebarProps {
  onSettingsClick: () => void;
  userRole: "admin" | "seller" | "customer";
}

export function Sidebar({ onSettingsClick, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Filter nav items based on user role
  const navItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 border-r border-border bg-background">
      <nav className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.label);
              const isItemActive = isActive(item.href);

              return (
                <li key={item.label}>
                  <div>
                    {hasChildren ? (
                      <div className="flex items-center gap-0">
                        <Link
                          href={item.href}
                          className={cn(
                            "flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isItemActive
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                        </Link>
                        <button
                          onClick={() => toggleExpanded(item.label)}
                          suppressHydrationWarning
                          className={cn(
                            "rounded-lg p-2 transition-colors",
                            isItemActive
                              ? "text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isItemActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </div>

                  {hasChildren && isExpanded && (
                    <ul className="ml-8 mt-1 space-y-1">
                      {item.children?.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                              pathname === child.href
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Settings at bottom */}
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            onClick={onSettingsClick}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Settings</span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}
