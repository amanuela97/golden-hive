import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import {
  isRouteAccessible,
  type UserRole,
} from "@/app/[locale]/dashboard/config/navigation";
import { getUserRole } from "@/lib/user-role";
import { cache } from "react";

export type { UserRole };

export interface RoleProtectionOptions {
  allowedRoles?: UserRole[]; // If not provided, will check against navigation config
  redirectTo?: string;
  showNotFound?: boolean; // If true, return shouldShowNotFound flag instead of calling notFound()
  pathname?: string; // Optional pathname to check against config
}

export interface ProtectDashboardRouteResult {
  role: UserRole;
  userId: string;
  locale: string;
  shouldShowNotFound?: boolean; // If true, page should call notFound()
}

/**
 * Get the current user's role and session (cached per request)
 * Uses the optimized getUserRole function which is already cached
 */
export const getDashboardUser = cache(async () => {
  const locale = await getLocale();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect({ href: "/login", locale });
  }

  // Session is guaranteed to be non-null after redirect check
  // TypeScript doesn't recognize redirect as never-returning, so we assert
  const userId = session!.user.id;
  if (!userId) {
    redirect({ href: "/login", locale });
  }

  // Use the optimized getUserRole function which is already cached
  const { roleName, error } = await getUserRole(userId);

  const role = roleName?.toLowerCase() as UserRole;

  if (error || !role) {
    redirect({ href: "/onboarding", locale });
  }

  return {
    session,
    role,
    userId,
  };
});

/**
 * Protect a dashboard route with role-based access control
 * If allowedRoles is not provided, it will check against the navigation config
 * This function is optimized to avoid unnecessary database calls by using React cache
 *
 * Note: If showNotFound is true and access is denied, this function returns
 * shouldShowNotFound: true instead of calling notFound() directly. The page
 * component should check this flag and call notFound() itself to ensure proper
 * layout inheritance.
 */
export async function protectDashboardRoute(
  options: RoleProtectionOptions = {}
): Promise<ProtectDashboardRouteResult> {
  const locale = await getLocale();

  // Get user (cached per request)
  const user = await getDashboardUser();

  // Get current pathname from headers if not provided
  const headersList = await headers();
  const currentPathname =
    options.pathname ||
    headersList.get("x-pathname") ||
    headersList.get("x-invoke-path") ||
    "";

  // If allowedRoles is not provided, automatically check against navigation config
  // Only check if we have a pathname to check
  if (!options.allowedRoles) {
    if (!currentPathname) {
      // If no pathname provided and no allowedRoles, deny access for safety
      if (options.showNotFound) {
        return {
          role: user.role,
          userId: user.userId,
          locale,
          shouldShowNotFound: true,
        };
      }
      redirect({ href: options.redirectTo || "/dashboard", locale });
    }

    // Check route accessibility
    const isAccessible = isRouteAccessible(currentPathname, user.role);

    if (!isAccessible) {
      if (options.showNotFound) {
        // Return flag instead of calling notFound() directly
        // This ensures proper layout inheritance
        return {
          role: user.role,
          userId: user.userId,
          locale,
          shouldShowNotFound: true,
        };
      }
      redirect({ href: options.redirectTo || "/dashboard", locale });
    }
  } else if (options.allowedRoles) {
    // Use explicit allowedRoles if provided
    if (!options.allowedRoles.includes(user.role)) {
      if (options.showNotFound) {
        // Return flag instead of calling notFound() directly
        // This ensures proper layout inheritance
        return {
          role: user.role,
          userId: user.userId,
          locale,
          shouldShowNotFound: true,
        };
      }
      redirect({ href: options.redirectTo || "/dashboard", locale });
    }
  }

  return {
    role: user.role,
    userId: user.userId,
    locale,
  };
}
