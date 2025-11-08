import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { routing } from "./i18n/routing";
import createIntlMiddleware from "next-intl/middleware";

export const runtime = "nodejs";

// Create next-intl middleware
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip locale processing for Next.js internal paths and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/i)
  ) {
    // For static assets and API routes, let them through without locale processing
    return NextResponse.next();
  }

  // First run next-intl middleware for locale detection and routing
  const intlResponse = intlMiddleware(req);

  // Extract locale from pathname (e.g., /en/dashboard, /fi/products)
  const localeMatch = pathname.match(/^\/(en|fi|ne)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  const pathWithoutLocale = localeMatch
    ? pathname.slice(locale.length + 1)
    : pathname;

  // Handle auth and dashboard routing after locale is determined
  const headersObj = Object.fromEntries(req.headers.entries());
  const session = await auth.api.getSession({ headers: headersObj });

  const isDashboardRoute = pathWithoutLocale.startsWith("/dashboard");
  const isAuthRoute =
    pathWithoutLocale.startsWith("/login") ||
    pathWithoutLocale.startsWith("/register") ||
    pathWithoutLocale.startsWith("/signup") ||
    pathWithoutLocale.startsWith("/forgot-password");

  // Redirect unauthenticated users from /dashboard to /login
  if (isDashboardRoute && !session) {
    const loginUrl = new URL(`/${locale}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Handle role-based dashboard access
  if (isDashboardRoute && session) {
    try {
      // Get user's role
      const userRole = await db
        .select({
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, session.user.id))
        .limit(1);

      if (userRole.length === 0) {
        // User has no role, redirect to onboarding
        const onboardingUrl = new URL(`/${locale}/onboarding`, req.url);
        return NextResponse.redirect(onboardingUrl);
      }

      const userRoleName = userRole[0].roleName.toLowerCase();
      const pathSegments = pathWithoutLocale.split("/");
      const expectedRole = pathSegments[2]; // Extract role from /dashboard/{role}

      // Define valid role names
      const validRoles = ["admin", "seller", "customer"];

      // Only redirect if the user is trying to access a different role's dashboard
      // Allow access to sub-pages of the same role (e.g., /dashboard/admin/products)
      if (
        expectedRole &&
        validRoles.includes(expectedRole) &&
        expectedRole !== userRoleName
      ) {
        const correctDashboardUrl = new URL(
          `/${locale}/dashboard/${userRoleName}`,
          req.url
        );
        return NextResponse.redirect(correctDashboardUrl);
      }

      // If user is accessing /dashboard without role, redirect to their role dashboard
      if (pathWithoutLocale === "/dashboard") {
        const roleDashboardUrl = new URL(
          `/${locale}/dashboard/${userRoleName}`,
          req.url
        );
        return NextResponse.redirect(roleDashboardUrl);
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to login
      const loginUrl = new URL(`/${locale}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users from /login to their role dashboard
  if (isAuthRoute && session) {
    try {
      const userRole = await db
        .select({
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, session.user.id))
        .limit(1);

      if (userRole.length > 0) {
        const userRoleName = userRole[0].roleName.toLowerCase();
        const dashboardUrl = new URL(
          `/${locale}/dashboard/${userRoleName}`,
          req.url
        );
        return NextResponse.redirect(dashboardUrl);
      } else {
        // User has no role, redirect to onboarding
        const onboardingUrl = new URL(`/${locale}/onboarding`, req.url);
        return NextResponse.redirect(onboardingUrl);
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to dashboard
      const dashboardUrl = new URL(`/${locale}/dashboard`, req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Return the intl middleware response
  return intlResponse;
}

// Matcher config to exclude Next.js internal paths and static assets
export const config = {
  matcher: [
    // Match all pathnames except for:
    // - api routes
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - static files with extensions
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
