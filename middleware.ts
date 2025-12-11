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
  
  // Add pathname to headers for layout to check
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-invoke-path", pathname);
  requestHeaders.set("x-url", req.url);

  // Skip locale processing for Next.js internal paths and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/i)
  ) {
    // For static assets and API routes, let them through without locale processing
    const response = NextResponse.next();
    response.headers.set("x-invoke-path", pathname);
    response.headers.set("x-url", req.url);
    return response;
  }

  // First run next-intl middleware for locale detection and routing
  const intlResponse = intlMiddleware(req);
  
  // Add pathname to response headers for layout to check
  // This allows server components to know the current pathname
  // Use the final pathname after any redirects
  let finalPathname = pathname;
  
  if (intlResponse instanceof NextResponse) {
    // Check if there's a redirect
    if (intlResponse.status >= 300 && intlResponse.status < 400) {
      const location = intlResponse.headers.get("location");
      if (location) {
        try {
          const redirectUrl = new URL(location, req.url);
          finalPathname = redirectUrl.pathname;
        } catch {
          // If URL parsing fails, use original pathname
        }
      }
    }
    intlResponse.headers.set("x-invoke-path", finalPathname);
  } else {
    // If intlResponse is not a NextResponse, create a new one
    const response = NextResponse.next();
    response.headers.set("x-invoke-path", finalPathname);
    return response;
  }

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

  // Handle dashboard access - all users go to /dashboard
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

      // Redirect old role-specific dashboard routes to unified /dashboard
      const pathSegments = pathWithoutLocale.split("/");
      const expectedRole = pathSegments[2]; // Extract role from /dashboard/{role}
      const validRoles = ["admin", "seller", "customer"];

      if (
        expectedRole &&
        validRoles.includes(expectedRole) &&
        pathSegments.length === 3
      ) {
        // Redirect /dashboard/{role} to /dashboard
        const dashboardUrl = new URL(`/${locale}/dashboard`, req.url);
        const response = NextResponse.redirect(dashboardUrl);
        response.headers.set("x-invoke-path", `/${locale}/dashboard`);
        return response;
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to login
      const loginUrl = new URL(`/${locale}/login`, req.url);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-invoke-path", pathname);
      return response;
    }
  }

  // Redirect authenticated users from /login to unified dashboard
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
        const dashboardUrl = new URL(`/${locale}/dashboard`, req.url);
        const response = NextResponse.redirect(dashboardUrl);
        response.headers.set("x-invoke-path", `/${locale}/dashboard`);
        return response;
      } else {
        // User has no role, redirect to onboarding
        const onboardingUrl = new URL(`/${locale}/onboarding`, req.url);
        const response = NextResponse.redirect(onboardingUrl);
        response.headers.set("x-invoke-path", `/${locale}/onboarding`);
        return response;
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to dashboard
      const dashboardUrl = new URL(`/${locale}/dashboard`, req.url);
      const response = NextResponse.redirect(dashboardUrl);
      response.headers.set("x-invoke-path", `/${locale}/dashboard`);
      return response;
    }
  }

  // Ensure the header is set on the final response
  if (intlResponse instanceof NextResponse) {
    // If we haven't set the header yet (non-redirect case), set it now
    if (!intlResponse.headers.get("x-invoke-path")) {
      intlResponse.headers.set("x-invoke-path", pathname);
    }
    if (!intlResponse.headers.get("x-url")) {
      intlResponse.headers.set("x-url", req.url);
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
