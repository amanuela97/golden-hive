import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { sellerPayouts, store, userRoles, roles, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptEsewaId } from "@/lib/esewa-encrypt";
import { decryptBankDetails } from "@/lib/bank-encrypt";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return { allowed: false, status: 401 as const };
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
    return { allowed: false, status: 403 as const };
  }
  return { allowed: true, userId: session.user.id };
}

/**
 * GET /api/admin/payouts/[payoutId]/reveal?type=esewa|bank
 * Returns decrypted eSewa ID or bank details. Logs audit when bank is viewed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const authResult = await requireAdmin();
  if (!authResult.allowed) {
    const status = "status" in authResult ? authResult.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { payoutId } = await params;
  const type = req.nextUrl.searchParams.get("type");
  if (!payoutId || (type !== "esewa" && type !== "bank")) {
    return NextResponse.json(
      { error: "payoutId and type=esewa|bank required" },
      { status: 400 }
    );
  }

  const [payout] = await db
    .select()
    .from(sellerPayouts)
    .where(eq(sellerPayouts.id, payoutId))
    .limit(1);

  if (!payout || payout.provider !== "esewa") {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const [storeRow] = await db
    .select({
      esewaId: store.esewaId,
      bankDetailsEncrypted: store.bankDetailsEncrypted,
    })
    .from(store)
    .where(eq(store.id, payout.storeId))
    .limit(1);

  if (!storeRow) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (type === "esewa") {
    const esewaId = decryptEsewaId(storeRow.esewaId);
    return NextResponse.json({ esewaId: esewaId || null });
  }

  const bank = decryptBankDetails(storeRow.bankDetailsEncrypted);
  if (!bank) {
    return NextResponse.json({ bankDetails: null });
  }

  await db.insert(auditLog).values({
    action: "bank_details_viewed",
    entityType: "store",
    entityId: payout.storeId,
    userId: authResult.userId,
    metadata: {
      payoutId,
      storeId: payout.storeId,
      viewedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    bankDetails: {
      accountHolderName: bank.accountHolderName,
      bankName: bank.bankName,
      branchName: bank.branchName,
      accountNumberMasked: "****" + bank.accountNumber.slice(-4),
      accountNumber: bank.accountNumber,
    },
  });
}
