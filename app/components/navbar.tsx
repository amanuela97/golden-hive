"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always show the same nav items structure to prevent hydration issues
  const navItems = [
    { name: "Products", href: "/products" },
    { name: "About", href: "/about" },
    { name: "Feedback", href: "/feedback" },
    { name: "Dashboard", href: "/dashboard", requiresAuth: true },
    { name: "Login", href: "/login", requiresAuth: false },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-background shadow-sm">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo and Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <BeeLogo />
          <span className="font-serif text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Golden Hive
          </span>
        </Link>

        {/* Navigation Items */}
        <ul className="flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <li
                key={item.href}
                className={cn(
                  // Hide items based on authentication state
                  item.requiresAuth === true &&
                    (!mounted || !session?.user) &&
                    "hidden",
                  item.requiresAuth === false &&
                    (!mounted || session?.user) &&
                    "hidden"
                )}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "text-sm font-medium uppercase tracking-wide transition-colors",
                    isActive
                      ? "text-accent"
                      : "text-foreground/70 hover:text-accent"
                  )}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
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
