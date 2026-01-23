import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function GET() {
  try {
    // Get platform balance
    const balance = await stripe.balance.retrieve();

    // Get recent payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 10,
    });

    // Get charge details for each payment intent
    const paymentIntentsWithCharges = await Promise.all(
      paymentIntents.data.map(async (pi) => {
        let charge = null;
        if (pi.latest_charge) {
          try {
            const chargeData = await stripe.charges.retrieve(
              typeof pi.latest_charge === "string"
                ? pi.latest_charge
                : pi.latest_charge.id
            );
            charge = {
              id: chargeData.id,
              status: chargeData.status,
              amount: chargeData.amount,
              captured: chargeData.captured,
            };
          } catch (error) {
            // Charge might not exist or be accessible
            console.warn(
              `Could not retrieve charge for payment intent ${pi.id}:`,
              error
            );
          }
        }

        return {
          id: pi.id,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency,
          amount_capturable: pi.amount_capturable,
          amount_received: pi.amount_received,
          created: new Date(pi.created * 1000).toISOString(),
          charge,
        };
      })
    );

    return NextResponse.json({
      platformBalance: {
        available: balance.available.map((b) => ({
          currency: b.currency,
          amount: b.amount,
          amountFormatted: (b.amount / 100).toFixed(2),
          source_types: b.source_types,
        })),
        pending: balance.pending.map((b) => ({
          currency: b.currency,
          amount: b.amount,
          amountFormatted: (b.amount / 100).toFixed(2),
          source_types: b.source_types,
        })),
        connect_reserved:
          balance.connect_reserved?.map((b) => ({
            currency: b.currency,
            amount: b.amount,
            amountFormatted: (b.amount / 100).toFixed(2),
          })) || [],
      },
      recentPaymentIntents: paymentIntentsWithCharges,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
