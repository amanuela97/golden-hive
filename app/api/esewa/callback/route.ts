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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const failureRedirect = `${baseUrl}/checkout/cancel`;

  if (status === "failure" || !ref) {
    return NextResponse.redirect(failureRedirect);
  }

  let orderIds: string[];
  try {
    const decoded = Buffer.from(ref, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { orderIds: string[] };
    orderIds = parsed.orderIds;
  } catch {
    return NextResponse.redirect(failureRedirect);
  }

  if (data && signature) {
    const verification = verifyEsewaCallback(data, signature);
    if (!verification.valid) {
      return NextResponse.redirect(failureRedirect);
    }
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
    const orderPlatformFee = orderAmount * 0.05;
    const esewaFee = 0;

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

  return NextResponse.redirect(
    `${baseUrl}/checkout/success?orderIds=${encodeURIComponent(orderIds.join(","))}`
  );
}
