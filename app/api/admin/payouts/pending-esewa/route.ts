import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sellerPayouts, store, userRoles, roles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const userRole = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);
  const isAdmin = userRole.some(
    (r) => r.roleName?.toLowerCase() === "admin"
  );
  if (!isAdmin) {
    return { error: "Admin only", status: 403 as const };
  }
  return { session };
}

/**
 * GET /api/admin/payouts/pending-esewa
 * Returns list of pending eSewa payouts with store name and eSewa ID.
 */
export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const pending = await db
    .select({
      id: sellerPayouts.id,
      storeId: sellerPayouts.storeId,
      amount: sellerPayouts.amount,
      currency: sellerPayouts.currency,
      requestedAt: sellerPayouts.requestedAt,
      storeName: store.storeName,
      esewaId: store.esewaId,
    })
    .from(sellerPayouts)
    .innerJoin(store, eq(sellerPayouts.storeId, store.id))
    .where(
      and(
        eq(sellerPayouts.provider, "esewa"),
        eq(sellerPayouts.status, "pending")
      )
    )
    .orderBy(sellerPayouts.requestedAt);

  return NextResponse.json({
    success: true,
    payouts: pending.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      storeName: p.storeName,
      amount: parseFloat(p.amount),
      currency: p.currency,
      esewaId: p.esewaId,
      requestedAt: p.requestedAt,
    })),
  });
}
