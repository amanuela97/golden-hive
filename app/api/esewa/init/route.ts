import { NextRequest, NextResponse } from "next/server";
import { buildEsewaPaymentPayload, getEsewaFormSubmitUrl } from "@/lib/esewa";
import { db } from "@/db";
import { orders } from "@/db/schema";
import {  inArray } from "drizzle-orm";
import crypto from "crypto";

/**
 * POST /api/esewa/init
 * Body: { orderIds: string[], totalAmount: string, currency: string (e.g. NPR), productName?: string }
 * Returns: { success, formPayload } for client to POST to eSewa, or { error }.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ESEWA_SECRET_KEY) {
      return NextResponse.json(
        { error: "eSewa is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { orderIds, totalAmount, currency, productName } = body as {
      orderIds: string[];
      totalAmount: string;
      currency?: string;
      productName?: string;
    };

    if (!orderIds?.length || !totalAmount) {
      return NextResponse.json(
        { error: "orderIds and totalAmount are required" },
        { status: 400 }
      );
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid totalAmount" },
        { status: 400 }
      );
    }

    const orderRows = await db
      .select({ id: orders.id, totalAmount: orders.totalAmount, paymentStatus: orders.paymentStatus })
      .from(orders)
      .where(inArray(orders.id, orderIds))
      .limit(orderIds.length);

    if (orderRows.length !== orderIds.length) {
      return NextResponse.json(
        { error: "One or more orders not found" },
        { status: 404 }
      );
    }

    const alreadyPaid = orderRows.find((o) => o.paymentStatus === "paid");
    if (alreadyPaid) {
      return NextResponse.json(
        { error: "Order already paid" },
        { status: 400 }
      );
    }

    const ref = Buffer.from(JSON.stringify({ orderIds })).toString("base64url");
    const transactionUuid = `esewa_${ref}_${crypto.randomBytes(6).toString("hex")}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/api/esewa/callback?status=success&ref=${encodeURIComponent(ref)}`;
    const failureUrl = `${baseUrl}/api/esewa/callback?status=failure&ref=${encodeURIComponent(ref)}`;

    console.log("[eSewa init] Payment URLs for eSewa redirect:", {
      successUrl,
      failureUrl,
      orderIds,
      totalAmount,
    });

    const formPayload = buildEsewaPaymentPayload({
      totalAmount: amount.toFixed(2),
      transactionUuid,
      productCode: process.env.ESEWA_PRODUCT_CODE || "EPAYTEST",
      productName: productName || `Order ${orderIds[0]}`,
      successUrl,
      failureUrl,
    });

    return NextResponse.json({
      success: true,
      formPayload,
      formActionUrl: getEsewaFormSubmitUrl(),
      transactionUuid,
    });
  } catch (error) {
    console.error("[eSewa init]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to init eSewa payment" },
      { status: 500 }
    );
  }
}
