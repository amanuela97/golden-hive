import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, roles, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const currentUser = session.user;

    // Check if user exists in our database
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    if (existingUser.length > 0) {
      // User exists, get their role and redirect to appropriate dashboard
      const userRole = await db
        .select({
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, currentUser.id))
        .limit(1);

      if (userRole.length > 0) {
        return NextResponse.redirect(new URL(`/dashboard`, request.url));
      } else {
        // User exists but has no role, redirect to onboarding
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    } else {
      // User doesn't exist, redirect to onboarding
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  } catch (error) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
  }
}
