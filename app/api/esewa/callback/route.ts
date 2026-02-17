import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  orderPayments,
  orderEvents,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { updateSellerBalance } from "@/app/[locale]/actions/seller-balance";
import { verifyEsewaCallback } from "@/lib/esewa";

/** Platform fee rate (5%) - applied in order currency for consistency (NPR for eSewa, etc.) */
const PLATFORM_FEE_RATE = 0.05;
/** eSewa fee per order in order currency (set > 0 when eSewa charges a fee) */
const ESEWA_FEE_AMOUNT = 0;

/**
 * GET /api/esewa/callback?status=success|failure&ref=<base64url orderIds json>
 * eSewa may append &data=...&signature=... on success.
 * On success: create order_payments (provider esewa), ledger entries, mark orders paid, redirect to success.
 * On failure: redirect to cancel/failure.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const ref = searchParams.get("ref");
  const data = searchParams.get("data");
  const signature = searchParams.get("signature");

  // Debug: log all query params eSewa sends (avoid logging full data/signature if huge)
  const allParams = Object.fromEntries(searchParams.entries());
  console.log("[eSewa callback] Incoming URL query params:", {
    ...allParams,
    data: data ? `${data.substring(0, 50)}...` : null,
    signature: signature ? `${signature.substring(0, 20)}...` : null,
  });
  console.log("[eSewa callback] status:", status, "ref present:", !!ref, "ref length:", ref?.length ?? 0);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const failureRedirect = `${baseUrl}/checkout/cancel`;

  if (status === "failure" || !ref) {
    console.log("[eSewa callback] Redirecting to cancel: status is failure or ref missing", {
      status,
      hasRef: !!ref,
    });
    return NextResponse.redirect(failureRedirect);
  }

  // eSewa appends ?data=...&signature=... to our ref, so ref can be "OUR_BASE64?data=ESEWA_DATA".
  // Use only the part before "?" for our orderIds decode; parse the rest for data/signature.
  const refForOrderIds = ref.includes("?") ? ref.split("?")[0] : ref;
  const refTrailing = ref.includes("?") ? ref.split("?").slice(1).join("?") : null;
  let dataParam = data;
  let signatureParam = signature;
  if (refTrailing) {
    try {
      const trailingParams = new URLSearchParams(refTrailing);
      dataParam = dataParam ?? trailingParams.get("data");
      signatureParam = signatureParam ?? trailingParams.get("signature");
    } catch {
      // ignore
    }
  }

  let orderIds: string[];
  try {
    const decoded = Buffer.from(refForOrderIds, "base64url").toString("utf-8");
    console.log("[eSewa callback] Decoded ref:", decoded);
    const parsed = JSON.parse(decoded) as { orderIds: string[] };
    orderIds = parsed.orderIds;
    console.log("[eSewa callback] Parsed orderIds:", orderIds);
  } catch (e) {
    console.log("[eSewa callback] Redirecting to cancel: ref decode/parse failed", e);
    return NextResponse.redirect(failureRedirect);
  }

  if (dataParam && signatureParam) {
    const verification = verifyEsewaCallback(dataParam, signatureParam);
    console.log("[eSewa callback] Signature verification:", {
      valid: verification.valid,
    });
    if (!verification.valid) {
      console.log("[eSewa callback] Redirecting to cancel: signature invalid");
      return NextResponse.redirect(failureRedirect);
    }
  } else {
    console.log("[eSewa callback] No data/signature in URL, skipping verification");
  }

  const orderRows = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentStatus: orders.paymentStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      status: orders.status,
    })
    .from(orders)
    .where(inArray(orders.id, orderIds));

  if (orderRows.length === 0) {
    return NextResponse.redirect(failureRedirect);
  }

  const alreadyPaid = orderRows.every((o) => o.paymentStatus === "paid");
  const successOrderIds = orderIds.join(",");
  const successRedirect = `${baseUrl}/checkout/success?orderIds=${encodeURIComponent(successOrderIds)}`;
  if (alreadyPaid) {
    return NextResponse.redirect(successRedirect);
  }

  const totalAmount = orderRows.reduce(
    (sum, o) => sum + parseFloat(o.totalAmount || "0"),
    0
  );

  for (const order of orderRows) {
    if (order.paymentStatus === "paid") continue;

    const orderAmount = parseFloat(order.totalAmount || "0");
    const orderPlatformFee = orderAmount * PLATFORM_FEE_RATE; // 5% in order currency (NPR for eSewa)
    const esewaFee = ESEWA_FEE_AMOUNT;

    const [paymentRecord] = await db
      .insert(orderPayments)
      .values({
        orderId: order.id,
        amount: orderAmount.toFixed(2),
        currency: order.currency,
        provider: "esewa",
        providerPaymentId: `esewa_${order.id}_${Date.now()}`,
        platformFeeAmount: orderPlatformFee.toFixed(2),
        netAmountToStore: (
          orderAmount -
          orderPlatformFee -
          esewaFee
        ).toFixed(2),
        status: "completed",
        transferStatus: "held",
      })
      .returning();

    await updateSellerBalance({
      storeId: order.storeId!,
      type: "order_payment",
      amount: orderAmount,
      currency: order.currency,
      orderId: order.id,
      orderPaymentId: paymentRecord.id,
      description: "Order payment received (eSewa)",
    });

    await updateSellerBalance({
      storeId: order.storeId!,
      type: "platform_fee",
      amount: orderPlatformFee,
      currency: order.currency,
      orderId: order.id,
      orderPaymentId: paymentRecord.id,
      description: "Platform fee (5%) for order",
    });

    if (esewaFee > 0) {
      await updateSellerBalance({
        storeId: order.storeId!,
        type: "esewa_fee",
        amount: esewaFee,
        currency: order.currency,
        orderId: order.id,
        orderPaymentId: paymentRecord.id,
        description: "eSewa payment fee",
      });
    }

    const isFulfilled =
      order.fulfillmentStatus === "fulfilled" ||
      order.fulfillmentStatus === "partial";
    const newStatus = isFulfilled ? "completed" : order.status;

    await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        paidAt: new Date(),
        status: newStatus,
      })
      .where(eq(orders.id, order.id));

    await db.insert(orderEvents).values({
      orderId: order.id,
      type: "payment",
      message: "Payment received via eSewa",
      visibility: "internal",
      metadata: {
        provider: "esewa",
        amount: orderAmount.toFixed(2),
        currency: order.currency,
      },
      createdBy: null,
    });
  }

  console.log("[eSewa callback] Payment processing complete, redirecting to success for orderIds:", orderIds.join(","));
  return NextResponse.redirect(
    `${baseUrl}/checkout/success?orderIds=${encodeURIComponent(orderIds.join(","))}`
  );
}
