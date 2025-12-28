"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";

interface DashboardNavbarProps {
  userName?: string;
  userImage?: string;
}

export function DashboardNavbar({ userName, userImage }: DashboardNavbarProps) {
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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Logo */}
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
    </header>
  );
}
