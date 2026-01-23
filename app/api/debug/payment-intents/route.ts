import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { orderPayments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Get recent payment intents from database
    const recentPayments = await db
      .select({
        id: orderPayments.id,
        orderId: orderPayments.orderId,
        stripePaymentIntentId: orderPayments.stripePaymentIntentId,
        amount: orderPayments.amount,
        currency: orderPayments.currency,
        status: orderPayments.status,
        createdAt: orderPayments.createdAt,
      })
      .from(orderPayments)
      .where(eq(orderPayments.provider, "stripe"))
      .orderBy(desc(orderPayments.createdAt))
      .limit(10);

    // Check each payment intent in Stripe
    const paymentIntentDetails = await Promise.all(
      recentPayments
        .filter((p) => p.stripePaymentIntentId)
        .map(async (payment) => {
          try {
            const pi = await stripe.paymentIntents.retrieve(
              payment.stripePaymentIntentId!
            );

            // Get charge details if available
            let charge = null;
            if (pi.latest_charge) {
              try {
                const chargeId =
                  typeof pi.latest_charge === "string"
                    ? pi.latest_charge
                    : pi.latest_charge.id;
                const chargeData = await stripe.charges.retrieve(chargeId);
                charge = {
                  id: chargeData.id,
                  status: chargeData.status,
                  amount: chargeData.amount,
                  captured: chargeData.captured,
                  balance_transaction:
                    typeof chargeData.balance_transaction === "string"
                      ? chargeData.balance_transaction
                      : chargeData.balance_transaction?.id || null,
                };
              } catch (chargeError) {
                // Charge might not exist or be accessible
                console.warn(
                  `Could not retrieve charge for payment intent ${pi.id}:`,
                  chargeError
                );
              }
            }

            return {
              dbId: payment.id,
              orderId: payment.orderId,
              paymentIntentId: pi.id,
              status: pi.status,
              amount: pi.amount,
              currency: pi.currency,
              amount_capturable: pi.amount_capturable,
              amount_received: pi.amount_received,
              created: new Date(pi.created * 1000).toISOString(),
              latest_charge:
                typeof pi.latest_charge === "string"
                  ? pi.latest_charge
                  : pi.latest_charge?.id || null,
              charge,
            };
          } catch (error) {
            return {
              dbId: payment.id,
              orderId: payment.orderId,
              paymentIntentId: payment.stripePaymentIntentId,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
    );

    // Get platform balance
    const balance = await stripe.balance.retrieve();

    return NextResponse.json({
      balance: {
        available: balance.available.map((b) => ({
          currency: b.currency,
          amount: b.amount,
          amountFormatted: (b.amount / 100).toFixed(2),
        })),
        pending: balance.pending.map((b) => ({
          currency: b.currency,
          amount: b.amount,
          amountFormatted: (b.amount / 100).toFixed(2),
        })),
        connect_reserved:
          balance.connect_reserved?.map((b) => ({
            currency: b.currency,
            amount: b.amount,
            amountFormatted: (b.amount / 100).toFixed(2),
          })) || [],
      },
      paymentIntents: paymentIntentDetails,
      summary: {
        totalPaymentIntents: paymentIntentDetails.length,
        byStatus: paymentIntentDetails.reduce(
          (acc, pi) => {
            const status = pi.status || "unknown";
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
