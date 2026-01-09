You’re essentially building a **Stripe Connect–based escrow + ledger system**. The key to doing this cleanly (and safely) is to **separate money movement from accounting** and to **treat Stripe as the source of truth for cash, and your DB as the source of truth for balances**.

Below is a **battle-tested architecture** used by marketplaces like Etsy, Shopify, and Uber (simplified but solid).

---

# 1. High-level payout architecture

### Stripe accounts

You should have:

1. **Platform Stripe account**
   - Collects all customer payments
   - Holds funds temporarily
   - Charges platform fees
   - Pays Stripe fees
   - Executes payouts

2. **Connected Stripe accounts (Sellers + Admin store)**
   - Receive payouts
   - Never directly charge customers
   - Do not immediately receive funds

This implies:

➡️ **Destination charges with delayed transfers**
or
➡️ **Separate charges and transfers (recommended)**

---

# 2. Recommended Stripe flow (IMPORTANT)

### Use **Separate Charges and Transfers**

Why?

- Allows partial refunds
- Allows delayed payouts
- Allows fee adjustments
- Clean accounting
- Matches your “store now, pay later” requirement

### Payment flow

1. Customer pays
2. Money goes **only** to platform balance
3. You record ledger entries
4. Later, you transfer funds to sellers

```txt
Customer → Platform Stripe balance
Platform Stripe → Seller Stripe (later)
```

---

# 3. Core concept: Internal Ledger (non-negotiable)

Stripe **cannot** track your internal business rules.
You must maintain a **ledger table**.

### Ledger entry example

```ts
LedgerEntry {
  id
  sellerId
  orderId
  type:
    | sale
    | platform_fee
    | stripe_fee
    | shipping_label
    | refund
    | adjustment
    | payout
  amount: number (signed)
  currency
  status: pending | available | paid
  stripeReferenceId
  createdAt
}
```

➡️ **Never calculate balances from orders directly**
➡️ **Always calculate balances from ledger entries**

---

# 4. Order-level calculations

### Per order (per seller)

```txt
Product subtotal
+ Shipping cost
- Discount
----------------
= Gross order amount
```

### Fees

```txt
Platform fee (percentage or fixed)
Stripe fee (from webhook)
Shipping label cost (optional)
Refund adjustments (optional)
```

### Net seller earnings

```txt
Seller gross
- platform fee
- stripe fee (if you pass it to seller)
- shipping label cost
- refunds
----------------
= Seller net earnings
```

➡️ This number is **ledger-based**, not Stripe-based.

---

# 5. Stripe fees & refunds handling (critical)

### Stripe fees

- Stripe fees are deducted **only when payment is captured**
- For refunds:
  - Stripe may **partially return** fees
  - Webhooks tell you exact refunded fee amount

👉 **Never estimate Stripe fees**
👉 Always listen to:

- `charge.succeeded`
- `balance.transaction.created`
- `charge.refunded`

### Ledger approach

- Add Stripe fee as **negative ledger entry**
- If refunded, add **positive adjustment entry**

---

# 6. When should seller funds become “available”?

### Recommended holding periods

| Scenario           | Availability                |
| ------------------ | --------------------------- |
| Card payment       | After capture               |
| Refund window      | After X days (7–14 typical) |
| Shipping confirmed | Optional condition          |
| High-risk sellers  | Longer delay                |

### Example rule

```txt
available_at = max(
  payment_captured_at + 7 days,
  order_shipped_at
)
```

This protects you from:

- Chargebacks
- Refund abuse
- Shipping fraud

---

# 7. Payout execution logic

### Payout eligibility check

Seller can request payout if:

- Available balance ≥ minimum payout (e.g. €20)
- No open disputes
- Stripe account fully verified
- No pending refunds

### Payout execution

1. Calculate seller available balance
2. Create Stripe transfer
3. Create Stripe payout (optional auto)
4. Add `payout` ledger entry
5. Mark entries as paid

```ts
stripe.transfers.create({
  amount,
  currency,
  destination: sellerStripeAccountId,
});
```

---

# 8. What to show in the Seller Payout UI

### Balance summary (VERY IMPORTANT)

```txt
Available balance
Pending balance
On-hold balance
Lifetime earnings
Lifetime payouts
```

### Breakdown per order

- Order ID
- Sale amount
- Platform fee
- Stripe fee
- Shipping cost
- Net earnings
- Status (Pending / Available / Paid)

### Payout history

- Payout ID
- Date
- Amount
- Status
- Stripe reference
- Download CSV

### Upcoming payouts

- Estimated payout date
- Estimated amount

---

# 9. Admin payout dashboard (you need this)

Admins should see:

- Platform revenue
- Stripe fees paid
- Seller liabilities (money owed)
- Float balance (money you’re holding)
- Refund exposure
- Chargeback exposure

⚠️ This is **legally important**.

---

# 10. Refund logic (critical)

### Refund scenarios

| Scenario       | Effect                    |
| -------------- | ------------------------- |
| Before capture | No Stripe fee             |
| After capture  | Stripe fee partially lost |
| After payout   | Negative seller balance   |

### Negative balances

If seller already paid:

- Carry negative balance forward
- Deduct from next payout
- Or charge seller’s payment method (advanced)

---

# 11. Shipping label accounting

Shipping label purchase:

- Platform pays carrier
- Create negative ledger entry for seller
- Deduct from payout

Optional:

- Add shipping markup → platform revenue

---

# 12. Webhooks you MUST handle

```txt
payment_intent.succeeded
charge.succeeded
charge.refunded
balance.transaction.created
transfer.created
payout.paid
dispute.created
dispute.closed
```

Your DB must reconcile with Stripe events.

---

# 13. Legal & compliance considerations

You **must** consider:

- VAT on platform fees (EU)
- VAT on shipping markup
- KYC requirements (Stripe handles but you must enforce)
- Terms clearly stating payout timing
- Refund & dispute responsibility clarity

---

# 14. Common mistakes to avoid

❌ Paying sellers immediately
❌ Calculating balances from orders
❌ Estimating Stripe fees
❌ No ledger system
❌ No negative balance handling
❌ No webhook reconciliation

---

# 15. Recommended payout cadence

| Seller type     | Payout  |
| --------------- | ------- |
| New sellers     | Weekly  |
| Trusted sellers | Daily   |
| Admin store     | Instant |

---

Below I’ll **refine the payout system design** specifically to match the Etsy-style behavior you want, and I’ll be very concrete about **states, calculations, timing, and UI**.

---

## 1. Core balance states (Etsy-style)

You should explicitly model **three balances** per seller:

### 1️⃣ Pending balance

Money from sales that:

- Is paid by customer
- Is captured by Stripe
- **Is still in hold period**

**Not withdrawable**

---

### 2️⃣ Available for payout

Money that:

- Passed hold period
- Has no open disputes/refund risk
- Can be withdrawn or scheduled

**Withdrawable**

---

### 3️⃣ Paid out

Money that:

- Has already been transferred to seller

---

### Balance formula (important)

```txt
Pending = Σ ledger entries where status = pending
Available = Σ ledger entries where status = available
Paid = Σ ledger entries where status = paid
```

Never compute balances from orders directly.

---

## 2. Hold period logic (new vs established sellers)

### Seller trust tiers

You’ll want to classify sellers dynamically:

| Seller age | Hold period |
| ---------- | ----------- |
| 0–30 days  | 20 days     |
| 31–90 days | 7–10 days   |
| 90+ days   | 3 days      |
| Trusted    | 0–1 days    |

You can store this as:

```ts
Seller {
  id
  createdAt
  trustLevel: "new" | "standard" | "trusted"
  payoutDelayDays
}
```

### How hold period is applied

When a sale occurs:

```txt
sale_date + payoutDelayDays = available_at
```

Until `available_at`, funds stay **Pending**.

---

## 3. Ledger entry lifecycle (VERY IMPORTANT)

### On successful charge

Create ledger entries like:

```txt
+ Sale amount (pending)
- Platform fee (pending)
- Stripe fee (pending)
- Shipping label cost (pending, if any)
```

Each entry includes:

```ts
{
  sellerId,
  amount,
  type,
  status: "pending",
  availableAt
}
```

---

### Background job / cron (daily or hourly)

```ts
if (now >= availableAt && no_dispute && no_refund) {
  status = "available";
}
```

This is how Etsy moves funds automatically.

---

## 4. Refunds during hold period (Etsy behavior)

### If refund happens while funds are pending

- Cancel the pending ledger entries
- No payout impact
- Stripe fee often avoided

This is why Etsy holds funds early.

---

### Refund after funds become available but before payout

- Convert available balance back to zero
- Create refund ledger entry
- Seller never receives the money

---

### Refund after payout

- Create **negative available balance**
- Deduct from next payout
- Etsy does this too

---

## 5. Stripe fees handling (Etsy-aligned)

Stripe fees should be:

- Recorded **after capture**
- Adjusted via webhook
- Refunded partially when applicable

Ledger entries:

```txt
Stripe fee → pending → available → paid
Stripe fee refund → adjustment entry
```

Never estimate.

---

## 6. Seller payout configuration (manual + scheduled)

### Seller payout settings

```ts
PayoutSettings {
  sellerId
  method: "manual" | "automatic"
  schedule: "weekly" | "biweekly" | "monthly"
  minimumAmount
  payoutDayOfWeek?
  payoutDayOfMonth?
}
```

---

### Manual payout (Etsy-style button)

**Button enabled when:**

- Available balance ≥ minimum
- Stripe account verified
- No payout hold

Clicking:

1. Lock balance
2. Create Stripe transfer
3. Create payout ledger entry
4. Mark entries as paid

---

### Scheduled payouts

Cron job runs daily:

```txt
If today matches seller schedule AND available balance ≥ minimum
→ execute payout
```

---

## 7. What the Seller UI should show (Etsy-style)

````

Tooltip explanations (important).

---

### “Available for deposit” section

- Big CTA: **Request payout**
- Show next automatic payout date
- Show minimum payout threshold

---

Here’s how your **Seller Payout Page UI & logic** can be designed:

---

## 8. **Top-level balance summary**

**Shows the current net balance** (your ledger-based balance calculation):

```txt
Current Balance: €1,200.50
Available for Deposit: €950.30
Pending (on hold): €250.20
Amount Due: €120.00 (due by 15th Jan)
````

**Explanation of fields:**

- **Current Balance:** Net of all ledger entries (Available + Pending - Amount Due).
- **Available for Deposit:** Funds that can be withdrawn immediately (passed hold period, no disputes).
- **Pending (on hold):** Funds still in hold period or under review.
- **Amount Due:** Costs that the seller owes the platform (e.g., negative ledger balances from shipping labels, platform fees exceeding sales, etc.). Can be highlighted in red if >0.

**Logic for Amount Due:**

```ts
amountDue = SUM(ledger entries where type = fee/negative adjustment AND balance < 0)
```

- Due date can be set (e.g., 7 days after entry creation) and stored per ledger entry.

---

## 9. **Recent Activity Feed**

Instead of a “Sales Activity Table”, have **all events in a single timeline**, latest first.

### Columns / Fields:

| Date   | Type     | Description         | Amount  | Fee   | Tax   | Balance |
| ------ | -------- | ------------------- | ------- | ----- | ----- | ------- |
| 09 Jan | Sale     | Order #123          | €50.00  | €8.00 | €0.00 | €950.30 |
| 08 Jan | Fee      | Platform commission | -€5.00  | -     | -     | €900.30 |
| 07 Jan | Refund   | Order #122          | -€20.00 | €1.50 | €0.00 | €905.30 |
| 06 Jan | Shipping | Label cost          | -€10.00 | -     | -     | €925.30 |

**Details:**

- **Date:** Exact date of ledger entry.
- **Type:** Sale, Refund, Fee, Shipping, Adjustment, Payout.
- **Description:** Optional text describing order, payout, fee, or shipping.
- **Amount:** Positive for incoming, negative for outgoing.
- **Fee:** Stripe fee or platform fee portion.
- **Tax:** Will be implemented later.
- **Balance:** Running balance after this ledger entry.

**UI features:**

- Latest entries appear **on top** (like a bank statement).
- Color-coded amounts: green for positive, red for negative.
- Optional filters: type, date range, order ID.

**Logic:**

- Each row’s **Balance** is computed as:

```ts
rowBalance = previousRowBalance + rowAmount - rowFee - rowTax;
```

- Easier to calculate if you precompute in the backend for display.

---

## 10. **Payout History Table (optional separate section)**

Columns:

| Date   | Amount | Status | Method             | Reference |
| ------ | ------ | ------ | ------------------ | --------- |
| 05 Jan | €500   | Paid   | Manual             | STRP12345 |
| 01 Jan | €450   | Paid   | Scheduled (Weekly) | STRP12210 |

- Shows **completed payouts only**.
- Status: Paid, Pending, Failed.
- Reference: Stripe Transfer ID for traceability.

---

## 11. **Workflow/Logic for Ledger → UI**

1. **Aggregate balances**
   - Compute **Available**, **Pending**, **Amount Due**, **Current Balance** from ledger entries.

2. **Recent activity**
   - Pull **all ledger entries**, sorted by **date descending**.
   - Include all relevant fields (amount, fees, balance).

3. **Payout history**
   - Pull **all ledger entries where type = payout**, sorted by date descending.

---

## 12. **Special Notes / Enhancements**

- **Amount Due**:
  - Could be negative balance that arises if costs (shipping label, platform fees, refunds) exceed the seller’s Available funds.
  - Show **due date** clearly; optionally allow payment via platform wallet or external payment.

- **Recent activity**:
  - Combines **sales, fees, refunds, shipping costs, adjustments** — one single list.
  - Makes auditing easy for sellers.

- **Payout button / schedule**
  - Only enabled if **Available balance > 0** and **Amount Due ≤ 0**.
  - Show next scheduled payout date if automatic scheduling is active.

---

---

### Payout history

| Date   | Amount | Status | Method |
| ------ | ------ | ------ | ------ |
| Jun 10 | €300   | Paid   | Weekly |

Include CSV export.

---

## 13. Shipping labels (Etsy-compatible)

Shipping label purchase:

- Immediately deduct from **Available** if possible
- Otherwise deduct from **Pending**
- Otherwise create **negative balance**

Ledger entry:

```txt
- Shipping label cost (available)
```

---

## 14. Chargebacks & disputes (non-negotiable)

### On dispute opened

- Freeze related funds
- Move available → on-hold
- Prevent payout

### On dispute lost

- Deduct full amount + fee
- Create negative balance if needed

Etsy does exactly this.

---

## 15. Accounting & legal notes (important)

Because you are:

- Holding funds
- Delaying payouts
- Deducting fees

You must:

- Clearly state payout timing in ToS
- Clarify refund responsibility
- Track VAT on platform fees (EU)
- Treat seller balance as **liability**, not revenue

---
