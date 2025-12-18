import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    // 1) Authorize membership
    const member = await db
      .select()
      .from(storeMembers)
      .where(and(eq(storeMembers.storeId, storeId), eq(storeMembers.userId, session.user.id)))
      .limit(1);

    if (member.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Get store with Stripe account
    const storeData = await db
      .select()
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeData.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const storeInfo = storeData[0];

    if (!storeInfo.stripeAccountId) {
      return NextResponse.json(
        { error: "No connected account. Please create one first." },
        { status: 400 }
      );
    }

    // 3) Create account link for onboarding
    const link = await stripe.accountLinks.create({
      account: storeInfo.stripeAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments/onboarding/refresh?storeId=${storeId}`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments/onboarding/success?storeId=${storeId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Error creating account link:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account link" },
      { status: 500 }
    );
  }
}

