import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerPayouts, store } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptEsewaId } from "@/lib/esewa-encrypt";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const summary = pending.map((p) => ({
    id: p.id,
    storeName: p.storeName,
    amount: parseFloat(p.amount),
    currency: p.currency,
    esewaId: decryptEsewaId(p.esewaId),
    requestedAt: p.requestedAt,
  }));

  if (summary.length > 0 && process.env.RESEND_API_KEY) {
    const adminEmail =
      process.env.ADMIN_LIST?.split(",")[0]?.trim() ||
      process.env.ESEWA_PAYOUT_REMINDER_EMAIL;
    if (adminEmail) {
      try {
        const resend = (await import("@/lib/resend")).default;
        const lines = summary
          .map(
            (p) =>
              `- ${p.storeName}: ${p.amount} ${p.currency} (eSewa ID: ${p.esewaId || "—"}) — Requested ${p.requestedAt?.toISOString?.() || p.requestedAt}`
          )
          .join("\n");
        await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Golden Market <goldenmarket@resend.dev>",
          to: adminEmail,
          subject: `eSewa Payout Reminder: ${summary.length} pending payout(s)`,
          html: `<p>Please process the following eSewa payouts manually (send from platform eSewa to seller eSewa ID), then mark each as completed in the dashboard or via API.</p><pre>${lines}</pre><p>Mark completed: POST /api/admin/payouts/[payoutId]/complete</p>`,
        });
      } catch (e) {
        console.error("[esewa-payout-reminder] Email send failed:", e);
      }
    }
  }

  return NextResponse.json({
    success: true,
    count: summary.length,
    payouts: summary,
  });
}
