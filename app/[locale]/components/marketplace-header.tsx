"use client";

import { Search, ShoppingBag, User, Menu, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useCart } from "@/lib/cart-context";
import { useState, useEffect, useRef } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CategoryNavClient } from "./CategoryNavClient";
import { SearchSuggestions } from "./SearchSuggestions";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function MarketplaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { itemCount } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu and suggestions when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowSuggestions(false);
  }, [pathname]);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchQuery.trim().length >= 2) {
      setShowSuggestions(true);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Get favorites URL based on auth status
  const getFavoritesUrl = () => {
    return session?.user ? "/favorites" : "/guest/favorites";
  };

  // Check if we're on a dashboard page
  const isDashboardPage = pathname.startsWith("/dashboard");

  // Handle logout
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

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo and Category Nav */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo.png"
                alt="Golden Market Logo"
                width={80}
                height={0}
                className="object-contain"
              />
              <span className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Golden Market
              </span>
            </Link>
            {/* Category Navigation - hide on dashboard pages */}
            {!isDashboardPage && (
              <div className="hidden md:block">
                <CategoryNavClient />
              </div>
            )}
          </div>

          {/* Search bar - hide on dashboard pages */}
          {!isDashboardPage && (
            <form
              onSubmit={handleSearch}
              className="hidden flex-1 max-w-xl md:flex"
            >
              <div ref={searchContainerRef} className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search for products, stores, or categories..."
                  className="pl-10 pr-4 transition-shadow focus:shadow-md"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                />
                <SearchSuggestions
                  query={searchQuery}
                  isOpen={showSuggestions}
                  onClose={() => setShowSuggestions(false)}
                  onSelect={() => setShowSuggestions(false)}
                />
              </div>
            </form>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Favorites */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex hover:bg-accent/10 transition-colors group"
              asChild
            >
              <Link href={getFavoritesUrl()}>
                <Heart className="h-5 w-5 group-hover:text-primary transition-colors" />
                <span className="sr-only">Favorites</span>
              </Link>
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-accent/10 transition-colors group"
              asChild
            >
              <Link href="/cart">
                <ShoppingBag className="h-5 w-5 group-hover:text-primary transition-colors" />
                {mounted && itemCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center animate-in zoom-in-50 duration-300">
                    {itemCount}
                  </Badge>
                )}
                <span className="sr-only">Cart</span>
              </Link>
            </Button>

            {/* Account Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-accent/10 transition-colors group"
                >
                  <User className="h-5 w-5 group-hover:text-primary transition-colors" />
                  <span className="sr-only">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!session?.user ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/login">Sign In</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/register">Create Account</Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/stores">Stores</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/products">Products</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/feedback">Feedback</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile search and menu */}
        {isMobileMenuOpen && (
          <div className="border-t pb-4 pt-4 md:hidden space-y-4">
            {/* Category Navigation - Mobile */}
            {!isDashboardPage && (
              <div>
                <CategoryNavClient />
              </div>
            )}
            {/* Mobile Search - hide on dashboard pages */}
            {!isDashboardPage && (
              <form onSubmit={handleSearch}>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                  <Input
                    type="search"
                    placeholder="Search products..."
                    className="pl-10 pr-4"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={handleSearchFocus}
                  />
                  <SearchSuggestions
                    query={searchQuery}
                    isOpen={showSuggestions}
                    onClose={() => setShowSuggestions(false)}
                    onSelect={() => setShowSuggestions(false)}
                  />
                </div>
              </form>
            )}

            {/* Mobile Menu Items */}
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-start" asChild>
                <Link href="/stores">Stores</Link>
              </Button>
              <Button variant="ghost" className="justify-start" asChild>
                <Link href="/products">Products</Link>
              </Button>
              {!session?.user ? (
                <>
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/register">Create Account</Link>
                  </Button>
                </>
              ) : (
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              )}
              <Button variant="default" className="justify-start group" asChild>
                <Link href={getFavoritesUrl()}>
                  <Heart className="h-4 w-4 mr-2 group-hover:fill-current transition-all" />
                  Favorites
                </Link>
              </Button>
              <Button variant="ghost" className="justify-start group" asChild>
                <Link href="/cart">
                  <ShoppingBag className="h-4 w-4 mr-2 group-hover:text-primary transition-colors" />
                  Cart
                  {mounted && itemCount > 0 && (
                    <Badge className="ml-2">{itemCount}</Badge>
                  )}
                </Link>
              </Button>
              <div className="pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}

        {/* Mobile search (when menu is closed) - hide on dashboard pages */}
        {!isMobileMenuOpen && !isDashboardPage && (
          <div className="flex pb-4 md:hidden">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-10 pr-4"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                />
                <SearchSuggestions
                  query={searchQuery}
                  isOpen={showSuggestions}
                  onClose={() => setShowSuggestions(false)}
                  onSelect={() => setShowSuggestions(false)}
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
