"use client";

import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

type NavbarItem = {
  id?: number;
  label?: string;
  name?: string;
  href: string;
  order?: number | null;
  requiresAuth?: boolean | null;
  isVisible?: boolean | null;
};

type NavbarProps = {
  title?: string;
  logoUrl?: string;
  items?: NavbarItem[];
};

export function Navbar(props: NavbarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { itemCount, total } = useCart();
  const t = useTranslations("nav");

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Always show the same nav items structure to prevent hydration issues
  const defaultItems: NavbarItem[] = [
    { name: t("products"), href: "/products" },
    { name: t("about"), href: "/about" },
    { name: t("feedback"), href: "/feedback" },
    { name: t("dashboard"), href: "/dashboard", requiresAuth: true },
    { name: t("login"), href: "/login", requiresAuth: false },
  ];

  const navItems: NavbarItem[] = (
    props.items && props.items.length > 0
      ? [...props.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : defaultItems
  ).filter((i) => i.isVisible !== false);

  const filteredNavItems = navItems.filter((item) => {
    if (!mounted) return false;
    // Only restrict for explicit auth-gated items
    if (item.requiresAuth === true && !session?.user) return false;

    // Hide "Login" when the user is already logged in
    const isLoginItem =
      (item.href && item.href.toLowerCase() === "/login") ||
      (item.label ?? item.name ?? "").toLowerCase() === "login";
    if (session?.user && isLoginItem) return false;

    // Otherwise, show item regardless of requiresAuth value
    return true;
  });

  return (
    <nav className="sticky top-0 z-50 w-full bg-background shadow-sm">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo and Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          {props.logoUrl ? (
            <Image
              src={props.logoUrl}
              alt={props.title ?? t("goldenHive")}
              width={80}
              height={40}
            />
          ) : (
            <BeeLogo />
          )}
          <span className="font-serif text-2xl font-bold tracking-tight text-accent md:text-4xl">
            {props.title ?? t("goldenHive")}
          </span>
        </Link>

        {/* Desktop Navigation Items */}
        <div className="hidden md:flex items-center gap-8">
          <ul className="flex items-center gap-8">
            {filteredNavItems.map((item) => {
              const label = item.label ?? item.name ?? t("untitled");
              const isActive = pathname.includes(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "text-sm font-medium uppercase tracking-wide transition-colors",
                      isActive
                        ? "text-accent"
                        : "text-foreground/70 hover:text-accent"
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Language Switcher */}
          <LanguageSwitcher />
          {/* Cart Icon */}
          <Link
            href="/cart"
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
            {total > 0 && (
              <span className="text-sm font-semibold text-foreground">
                €{total.toFixed(2)}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={t("toggleMenu")}
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background shadow-lg">
          <ul className="container mx-auto px-4 py-4 space-y-4">
            {filteredNavItems.map((item) => {
              const label = item.label ?? item.name ?? t("untitled");
              const isActive = pathname.includes(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block text-sm font-medium uppercase tracking-wide transition-colors py-2",
                      isActive
                        ? "text-accent"
                        : "text-foreground/70 hover:text-accent"
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {/* Mobile Language Switcher */}
            <li>
              <div className="flex items-center gap-2 py-2">
                <LanguageSwitcher />
              </div>
            </li>
            {/* Mobile Cart Link */}
            <li>
              <Link
                href="/cart"
                className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide transition-colors py-2"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>{t("cart")}</span>
                {itemCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                    {itemCount}
                  </span>
                )}
                {total > 0 && (
                  <span className="ml-auto text-sm font-semibold">
                    €{total.toFixed(2)}
                  </span>
                )}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

function BeeLogo() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Bee body stripes */}
      <ellipse cx="24" cy="26" rx="10" ry="14" fill="#F5A623" />
      <rect x="14" y="20" width="20" height="3" rx="1.5" fill="#2C2416" />
      <rect x="14" y="26" width="20" height="3" rx="1.5" fill="#2C2416" />
      <rect x="14" y="32" width="20" height="3" rx="1.5" fill="#2C2416" />

      {/* Wings */}
      <ellipse
        cx="16"
        cy="20"
        rx="8"
        ry="10"
        fill="#FFF9E6"
        opacity="0.8"
        transform="rotate(-25 16 20)"
      />
      <ellipse
        cx="32"
        cy="20"
        rx="8"
        ry="10"
        fill="#FFF9E6"
        opacity="0.8"
        transform="rotate(25 32 20)"
      />

      {/* Head */}
      <circle cx="24" cy="14" r="6" fill="#F5A623" />

      {/* Antennae */}
      <path
        d="M21 11 Q19 8 18 6"
        stroke="#2C2416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27 11 Q29 8 30 6"
        stroke="#2C2416"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="18" cy="6" r="1.5" fill="#2C2416" />
      <circle cx="30" cy="6" r="1.5" fill="#2C2416" />

      {/* Eyes */}
      <circle cx="21" cy="14" r="1.5" fill="#2C2416" />
      <circle cx="27" cy="14" r="1.5" fill="#2C2416" />

      {/* Stinger */}
      <path d="M24 40 L24 43 L22 45 L24 43 L26 45 L24 43 Z" fill="#2C2416" />
    </svg>
  );
}
