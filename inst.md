Great question — **“Send invoice” looks simple but it touches a lot of core systems**.
I’ll give you a **Shopify-grade, step-by-step flow** you can directly implement.

I’ll assume:

- Order already exists
- This is a **payment request invoice** (not just a PDF receipt)
- Could be unpaid or partially paid

If any assumption is wrong, tell me and I’ll adapt.

---

## High-level intent of **Send Invoice**

> “Ask the customer to pay this order under these terms.”

This is **not**:

- capturing payment
- fulfilling
- archiving

It’s a **payment request + legal document**.

---

# ✅ Canonical Steps (in correct order)

---

## 1️⃣ Validate order state (gatekeeping)

Before doing anything:

### Must be true

- Order exists
- Order is **not canceled**
- Order is **not fully paid**
- Order has **customer email**
- Order has at least one line item

### If any fail

→ Show clear error and stop.

---

## 2️⃣ Lock financial snapshot (CRITICAL)

At invoice send time, you must **freeze money-related data**. (based on user choice)

What YOU should implement
✅ Make it optional, but:

Default it to ON

Make OFF an explicit merchant choice

This prevents accidental accounting mistakes.

Suggested UI copy (clear + safe)

Lock prices (recommended)
Prevent product prices, discounts, taxes, and shipping from changing after this invoice is sent.

Small tooltip:

Required for accounting and tax compliance.

Implementation details (important)
When lock = ON

Set:

order.financialsLockedAt = now()
order.financialsLockedReason = "invoice_sent"

Enforce:

Block edits to:

line items

prices

discounts

shipping

tax

Allow only:

refunds

cancellation

fulfillment

When lock = OFF

Allow edits

Resending invoice:

same invoice number OR

new invoice number (depending on your accounting rules)

Accounting-safe rule (this saves you later)

The first time money can be paid, prices must be lockable.

If payment link is live:

You should strongly encourage lock = ON

Or auto-lock once payment starts

---

## 3️⃣ Generate invoice number (NOT order number)

Shopify-style separation:

- `orderNumber` → internal / UI
- `invoiceNumber` → legal / accounting

Example:

```text
INV-2025-000431
```

### Rules

- Sequential
- Unique
- Never reused
- Never changed

Store it on:

```ts
order.invoiceNumber;
order.invoiceIssuedAt;
```

---

## 4️⃣ Generate invoice document (PDF / HTML)

This is the **official invoice**.

Must include:

- Seller legal info
- Buyer snapshot info
- Invoice number
- Invoice date
- Order number (reference)
- Line items
- Taxes (clearly broken down)
- Total
- Currency
- Payment terms

### Store it

- Generate PDF
- Store in cloudinary invoices/id/
- refrence it in db invoice_pdf_url
- Never regenerate silently

---

## 5️⃣ Create payment session / link

This is what the customer actually uses to pay.

### Generate:

- Secure, expiring payment link
- Tied to:
  - orderId
  - invoiceNumber
  - amount
  - currency

### Rules

- Single source of truth
- Idempotent (resending invoice reuses link)
- Optional expiration (e.g. 7–30 days)

Store:

```ts
order.paymentLink;
order.paymentLinkExpiresAt;
```

---

## 6️⃣ Send invoice email (atomic step)

Email should include:

- Invoice PDF (downloadable link)
- Total amount
- Due date
- Pay Now button (payment link)
- Invoice number (NOT order number)

### Important

Sending email should be:

- transactional
- logged
- retry-safe

Log event:

```txt
Invoice INV-2025-000431 sent to customer@example.com
```

---

## 7️⃣ Update order state

After successful send:

### Order

```txt
paymentStatus → pending
invoiceStatus → sent
invoiceSentAt → now()
```

### Do NOT:

- mark as paid
- reserve inventory again
- fulfill anything

---

## 8️⃣ Timeline / audit log entry

This matters more than you think.

Log:

```txt
Invoice INV-2025-000431 was sent to customer@example.com
```

This protects you legally and operationally.

---

# 🔁 What happens AFTER invoice is sent

### When customer pays:

1. Payment webhook received
2. Verify invoice + amount
3. Mark:
   - `paymentStatus = paid`
   - `paidAt`

4. Send receipt (NOT invoice)
5. Inventory stays reserved (already done at order creation)

---

### If invoice expires:

- Order remains unpaid
- Invoice can be resent (same number)
- Optional: generate new payment link

---

### If order changes after invoice

🚫 Do NOT edit the invoice
Instead:

- Cancel invoice
- Issue credit note
- Generate a new invoice

---

# ❌ What Send Invoice should NOT do

- ❌ Capture payment
- ❌ Fulfill items
- ❌ Change inventory
- ❌ Change totals
- ❌ Generate new order

---

# 🧠 Shopify mental model (important)

| Concept | Immutable?   |
| ------- | ------------ |
| Order   | Mostly       |
| Invoice | Yes          |
| Payment | Event-based  |
| Receipt | Regenerated  |
| Refund  | Separate doc |

---

# 📌 Minimal checklist (implementation-ready)

1. Validate order
2. Lock financials
3. Generate invoice number
4. Generate invoice PDF
5. Create payment link
6. Send email
7. Update order state
8. Write timeline entry

---

## Final one-liner

**“Send invoice” = freeze money, create a legal document, request payment, and log everything — nothing else.**
