Got it — your schema already has the key place to store Connect info: **`store.stripeAccountId`**. So the clean Drizzle/Neon approach is:

- Seller ↔ Store membership: `storeMembers` (`role: 'seller'`)
- Product belongs to store: `listing.storeId`
- Payout destination per order: `store.stripeAccountId`
- Optional payment audit trail: `orderPayments` already has fields for Stripe IDs + platform fee.

Below is the same implementation plan as before, but **tailored to your Drizzle schema + Neon**.

---

## 0) What you’ll implement

**Stripe Connect (Express)** marketplace flow:

1. Seller creates/links their **Stripe Connected Account**
2. Seller completes onboarding (KYC + bank)
3. Customer pays at checkout
4. Stripe automatically splits money:
   - **5% fee → your platform**
   - **95% → seller store** (`store.stripeAccountId`)

5. Webhook confirms payment → you mark `orders.paymentStatus = 'paid'`, insert `orderPayments`, etc.

> Important: A single Stripe Checkout Session can only send `transfer_data.destination` to **one connected account**. If you support “cart with multiple stores”, you’ll do **one checkout per store** (or implement a more advanced split flow). If your checkout is per-store, you’re perfect.

---

## 1) Minimal DB additions (optional but recommended)

You already have `store.stripeAccountId`. I also recommend adding a couple fields to track onboarding status (optional):

- `store.stripeOnboardingComplete` (boolean)
- `store.stripeChargesEnabled` (boolean)
- `store.stripePayoutsEnabled` (boolean)

---

## 2) Neon + Drizzle DB setup (server-side)

Example `src/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

---

## 3) Create a Stripe Connected Account and save to `store.stripeAccountId`

### Route: `POST /api/stripe/connect/create-account`

- Requires authenticated user
- Ensure they are allowed to manage that store (e.g. `storeMembers.role = 'admin'` or `'seller'` depending on your rules)
- Create Stripe account (type: `express`)
- Save returned `acct_...` into `store.stripeAccountId`

```ts
// app/api/stripe/connect/create-account/route.ts
import Stripe from "stripe";
import { db } from "@/db";
import { store, storeMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  const { storeId, userId } = await req.json(); // replace with your auth session userId

  // 1) authorize membership
  const member = await db.query.storeMembers.findFirst({
    where: and(
      eq(storeMembers.storeId, storeId),
      eq(storeMembers.userId, userId)
    ),
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  // 2) check if already exists
  const existing = await db.query.store.findFirst({
    where: eq(store.id, storeId),
  });
  if (!existing) return new Response("Store not found", { status: 404 });
  if (existing.stripeAccountId) {
    return Response.json({ stripeAccountId: existing.stripeAccountId });
  }

  // 3) create connected account
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // 4) persist on store
  await db
    .update(store)
    .set({ stripeAccountId: account.id })
    .where(eq(store.id, storeId));

  return Response.json({ stripeAccountId: account.id });
}
```

---

## 4) Create onboarding link (KYC + bank details)

### Route: `POST /api/stripe/connect/account-link`

This returns a URL you redirect the seller to.

```ts
// app/api/stripe/connect/account-link/route.ts
import Stripe from "stripe";
import { db } from "@/db";
import { store } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  const { storeId } = await req.json();

  const st = await db.query.store.findFirst({ where: eq(store.id, storeId) });
  if (!st?.stripeAccountId)
    return new Response("No connected account", { status: 400 });

  const link = await stripe.accountLinks.create({
    account: st.stripeAccountId,
    refresh_url: `${process.env.APP_URL}/dashboard/settings/payments/onboarding/refresh?storeId=${storeId}`,
    return_url: `${process.env.APP_URL}/dashboard/settings/payments/onboarding/success?storeId=${storeId}`,
    type: "account_onboarding",
  });

  return Response.json({ url: link.url });
}
```

---

## 5) Checkout Session with **5% commission**

### Route: `POST /api/stripe/checkout/create`

Assuming checkout is for **one store**.

You’ll:

- Create `orders` row first (paymentStatus: `pending`)
- Create Stripe Checkout Session
- Put your DB `orderId` in `metadata`
- Use:
  - `payment_intent_data.transfer_data.destination = store.stripeAccountId`
  - `payment_intent_data.application_fee_amount = 5%`

```ts
// app/api/stripe/checkout/create/route.ts
import Stripe from "stripe";
import { db } from "@/db";
import { store, orders, orderItems, listing } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  const body = await req.json();
  const { storeId, currency, items, customerEmail } = body;
  // items: [{ listingId, quantity }]

  const st = await db.query.store.findFirst({ where: eq(store.id, storeId) });
  if (!st?.stripeAccountId)
    return new Response("Seller not onboarded", { status: 400 });

  const listingIds = items.map((i: any) => i.listingId);
  const listings = await db
    .select()
    .from(listing)
    .where(inArray(listing.id, listingIds));

  // compute totals (simple example)
  let subtotal = 0;
  for (const it of items) {
    const l = listings.find((x) => x.id === it.listingId);
    if (!l) return new Response("Listing not found", { status: 400 });
    subtotal += Number(l.price) * it.quantity;
  }

  const total = subtotal; // add shipping/tax later if you want
  const platformFee = Math.round(total * 0.05 * 100); // cents
  const totalCents = Math.round(total * 100);

  // 1) create order in DB
  const [orderRow] = await db
    .insert(orders)
    .values({
      storeId,
      currency,
      subtotalAmount: subtotal.toFixed(2),
      totalAmount: total.toFixed(2),
      paymentStatus: "pending",
      customerEmail,
    })
    .returning({ id: orders.id });

  // 2) create order items in DB
  await db.insert(orderItems).values(
    items.map((it: any) => {
      const l = listings.find((x) => x.id === it.listingId)!;
      const unitPrice = Number(l.price);
      return {
        orderId: orderRow.id,
        listingId: l.id,
        title: l.name,
        quantity: it.quantity,
        unitPrice: unitPrice.toFixed(2),
        currency,
        lineSubtotal: (unitPrice * it.quantity).toFixed(2),
        lineTotal: (unitPrice * it.quantity).toFixed(2),
      };
    })
  );

  // 3) create checkout session (transfer 95% to seller, 5% to you)
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: items.map((it: any) => {
      const l = listings.find((x) => x.id === it.listingId)!;
      return {
        quantity: it.quantity,
        price_data: {
          currency,
          unit_amount: Math.round(Number(l.price) * 100),
          product_data: { name: l.name },
        },
      };
    }),
    payment_intent_data: {
      application_fee_amount: platformFee,
      transfer_data: {
        destination: st.stripeAccountId,
      },
      metadata: {
        orderId: orderRow.id,
        storeId,
      },
    },
    success_url: `${process.env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/checkout/cancel?orderId=${orderRow.id}`,
  });

  return Response.json({ url: session.url, orderId: orderRow.id });
}
```

---

## 6) Webhook: confirm payment + write `orderPayments` + update `orders`

You already have:

- `orders.paymentStatus`
- `orderPayments.stripeCheckoutSessionId`
- `orderPayments.stripePaymentIntentId`
- `orderPayments.platformFeeAmount`
- `orderPayments.netAmountToStore`

### Route: `POST /api/stripe/webhook`

Handle `checkout.session.completed` (or `payment_intent.succeeded`).

Key points in Next.js:

- Read **raw body**
- Verify signature with `STRIPE_WEBHOOK_SECRET`
- Use `metadata.orderId`

When paid:

- `orders.paymentStatus = 'paid'`
- `orders.paidAt = now()`
- Insert row into `orderPayments`

---

## 7) Where to store “seller payout account”

Use your schema exactly as-is:

- `store.stripeAccountId` ✅ (this is the destination)
- Seller controls store via `storeMembers`
- Listings already link to store via `listing.storeId`

That’s a solid marketplace structure.

---

## Environment variables you’ll need

```bash
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---
