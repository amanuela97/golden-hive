"use client";

import { useState } from "react";
import { LogOut, Heart, Package, Store, Menu, X, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  allNavItems,
  settingsSections,
} from "@/app/[locale]/dashboard/config/navigation";

interface DashboardNavbarProps {
  userName?: string;
  userImage?: string;
  userRole?: "admin" | "seller" | "customer";
}

export function DashboardNavbar({ userName, userImage, userRole = "customer" }: DashboardNavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedLabels, setExpandedLabels] = useState<string[]>([]);
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const displayName =
    userName ||
    session?.user?.name ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const displayImage = userImage || session?.user?.image;

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Logged out successfully!");
            router.push("/login");
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const navItems = allNavItems
    .filter((item) => !item.roles || item.roles.includes(userRole))
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter((child) => {
          if (child.href === "/dashboard/draft_orders")
            return userRole === "admin" || userRole === "seller";
          if (child.href === "/dashboard/orders/refund-requests")
            return userRole === "admin" || userRole === "seller";
          return true;
        });
        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        };
      }
      return item;
    });

  const toggleExpanded = (label: string) => {
    setExpandedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const visibleSettingsSections = settingsSections.filter(
    (s) => !s.roles || s.roles.includes(userRole)
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Mobile menu button */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-1 hover:opacity-80 transition-opacity min-w-0"
        >
          <Image
            src="/logo.png"
            alt="Golden Market Logo"
            width={80}
            height={0}
            className="object-contain w-12 sm:w-16 md:w-20 shrink-0"
          />
          <span className="text-sm sm:text-xl font-semibold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent truncate">
            Golden Market
          </span>
        </Link>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer">
                {displayImage && (
                  <AvatarImage
                    src={displayImage || "/placeholder.svg"}
                    alt={displayName}
                  />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {displayName}
                  </p>
                  {session?.user?.email && (
                    <p className="text-xs text-muted-foreground">
                      {session.user.email}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/favorites" className="cursor-pointer">
                  <Heart className="mr-2 h-4 w-4" />
                  <span>Favorites</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/products" className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4" />
                  <span>Products</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/stores" className="cursor-pointer">
                  <Store className="mr-2 h-4 w-4" />
                  <span>Stores</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[min(20rem,85vw)] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-lg">Menu</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedLabels.includes(item.label);
                const itemActive = isActive(item.href);

                return (
                  <li key={item.label}>
                    {hasChildren ? (
                      <>
                        <div className="flex items-center gap-0">
                          <Link
                            href={item.href}
                            onClick={() => setDrawerOpen(false)}
                            className={cn(
                              "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                              itemActive
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.label)}
                            className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        </div>
                        {isExpanded && item.children && (
                          <ul className="ml-8 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={() => setDrawerOpen(false)}
                                  className={cn(
                                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                                    pathname === child.href
                                      ? "font-medium text-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          itemActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 border-t border-border pt-4 px-3">
              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Settings
              </p>
              <ul className="mt-1 space-y-1">
                {visibleSettingsSections.map((section) => {
                  const Icon = section.icon;
                  const href = section.href ?? `/dashboard/settings/${section.id}`;
                  const isSectionActive =
                    pathname === href || pathname?.startsWith(href + "/");
                  return (
                    <li key={section.id}>
                      <Link
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isSectionActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {section.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
