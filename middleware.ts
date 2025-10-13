// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

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

  // Redirect authenticated users from /login to /dashboard
  if (isAuthRoute && session) {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
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
  ], // Protect all dashboard routes
};
