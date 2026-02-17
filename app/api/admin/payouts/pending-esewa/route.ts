import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sellerPayouts, store, userRoles, roles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptEsewaId } from "@/lib/esewa-encrypt";
import { decryptBankDetails, maskAccountNumber } from "@/lib/bank-encrypt";

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
      bankDetailsEncrypted: store.bankDetailsEncrypted,
    })
    .from(sellerPayouts)
    .innerJoin(store, eq(sellerPayouts.storeId, store.id))
    .where(
      and(
        eq(sellerPayouts.provider, "esewa"),
        eq(sellerPayouts.status, "pending")
      )
    )
    .orderBy(desc(sellerPayouts.requestedAt));

  return NextResponse.json({
    success: true,
    payouts: pending.map((p) => {
      const esewaDecrypted = decryptEsewaId(p.esewaId);
      const bankDecrypted = decryptBankDetails(p.bankDetailsEncrypted);
      return {
        id: p.id,
        storeId: p.storeId,
        storeName: p.storeName,
        amount: parseFloat(p.amount),
        currency: p.currency,
        esewaIdMasked: esewaDecrypted
          ? "*".repeat(Math.min(esewaDecrypted.length, 8)) + esewaDecrypted.slice(-4)
          : null,
        hasEsewaId: !!esewaDecrypted?.trim(),
        bankAccountMasked: bankDecrypted
          ? maskAccountNumber(bankDecrypted.accountNumber)
          : null,
        hasBankDetails: !!bankDecrypted,
        requestedAt: p.requestedAt,
      };
    }),
  });
}
