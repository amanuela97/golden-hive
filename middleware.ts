// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function middleware(req: NextRequest) {
  const headersObj = Object.fromEntries(req.headers.entries());
  const session = await auth.api.getSession({ headers: headersObj });
  const { pathname } = req.nextUrl;

  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password");

  // Redirect unauthenticated users from /dashboard to /login
  if (isDashboardRoute && !session) {
    const loginUrl = new URL("/login", req.url);
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
        const onboardingUrl = new URL("/onboarding", req.url);
        return NextResponse.redirect(onboardingUrl);
      }

      const userRoleName = userRole[0].roleName.toLowerCase();
      const pathSegments = pathname.split("/");
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
          `/dashboard/${userRoleName}`,
          req.url
        );
        return NextResponse.redirect(correctDashboardUrl);
      }

      // If user is accessing /dashboard without role, redirect to their role dashboard
      if (pathname === "/dashboard") {
        const roleDashboardUrl = new URL(`/dashboard/${userRoleName}`, req.url);
        return NextResponse.redirect(roleDashboardUrl);
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to login
      const loginUrl = new URL("/login", req.url);
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
        const dashboardUrl = new URL(`/dashboard/${userRoleName}`, req.url);
        return NextResponse.redirect(dashboardUrl);
      } else {
        // User has no role, redirect to onboarding
        const onboardingUrl = new URL("/onboarding", req.url);
        return NextResponse.redirect(onboardingUrl);
      }
    } catch (error) {
      console.error("Middleware error:", error);
      // On error, redirect to dashboard
      const dashboardUrl = new URL("/dashboard", req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/signup",
    "/forgot-password",
    "/onboarding",
  ], // Protect all dashboard routes and auth routes
};
