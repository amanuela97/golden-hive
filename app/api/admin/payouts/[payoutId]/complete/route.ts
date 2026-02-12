import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { markEsewaPayoutCompleted } from "@/app/[locale]/actions/seller-payouts";

async function requireAdminOrCronSecret(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { allowed: true };
  }
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
  return { allowed: true };
}

/**
 * POST /api/admin/payouts/[payoutId]/complete
 * Mark an eSewa payout as completed (debit seller balance).
 * Auth: admin session or CRON_SECRET.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const authResult = await requireAdminOrCronSecret(req);
  if (!authResult.allowed) {
    const status = "status" in authResult ? authResult.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { payoutId } = await params;
  if (!payoutId) {
    return NextResponse.json(
      { error: "payoutId required" },
      { status: 400 }
    );
  }

  const result = await markEsewaPayoutCompleted(payoutId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true });
}
