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

    // 1) Authorize membership - check if user is a member of this store
    const member = await db
      .select()
      .from(storeMembers)
      .where(and(eq(storeMembers.storeId, storeId), eq(storeMembers.userId, session.user.id)))
      .limit(1);

    if (member.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Check if store exists and already has a Stripe account
    const existing = await db
      .select()
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (existing[0].stripeAccountId) {
      return NextResponse.json({ stripeAccountId: existing[0].stripeAccountId });
    }

    // 3) Create connected account
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // 4) Persist on store
    await db
      .update(store)
      .set({ stripeAccountId: account.id })
      .where(eq(store.id, storeId));

    return NextResponse.json({ stripeAccountId: account.id });
  } catch (error) {
    console.error("Error creating Stripe account:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account" },
      { status: 500 }
    );
  }
}

