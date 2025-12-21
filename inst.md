This is a **core commerce action**, and getting it right will save you from inventory, accounting, and support nightmares.

I’ll give you a **Shopify-accurate, step-by-step flow** that fits **your draft → paid order model**.

---

# What **Refund** means (definition)

> **Refund = returning money to the customer**
> It does **not** automatically mean:

- canceling the order
- returning items
- restocking inventory

Those are **separate but optional** actions.

---

# Preconditions (very important)

Refund can be clicked **only if**:

- `paymentStatus = paid` or `partially_refunded`
- Order is **not draft**
- Refund amount ≤ paid amount − refunded amount

If not → block the action.

---

# Step-by-step: What should happen when **Refund** is clicked

---

## 1️⃣ Open refund modal (merchant decision)

The modal should let the merchant choose:

### a) Refund type

- Full refund
- Partial refund (by amount or by line item)

### b) Restock inventory? (checkbox)

- ⬜ Restock items
- Default:
  - **ON** if unfulfilled
  - **OFF** if fulfilled

### c) Reason (optional but recommended)

- Customer request
- Damaged
- Returned
- Fraud
- Other

---

## 2️⃣ Validate refund request

Before processing:

- Ensure refund amount is valid
- Ensure items exist
- Ensure quantities don’t exceed sold quantities

---

## 3️⃣ Process payment refund

### If payment was via stripe gateway

- const refund = await stripe.refunds.create(
  {
  payment_intent: paymentIntentId,
  amount, // omit for full refund
  refund_application_fee: false,
  reverse_transfer: true, // pulls money back from seller
  },
  {
  stripeAccount: sellerStripeAccountId,
  }
  );

### If payment was manual

- Mark refund as manual
- No external API call

Store:

```ts
refunds {
  id
  orderId
  amount
  currency
  paymentMethod
  reason
  createdAt
}
```

---

## 4️⃣ Update payment status

### Logic:

```ts
if (totalRefunded === totalPaid) {
  paymentStatus = "refunded";
} else {
  paymentStatus = "partially_refunded";
}
```

Also update:

```ts
order.refundedAmount += refund.amount;
```

---

## 5️⃣ Inventory adjustment (ONLY if chosen)

### If “Restock items” is checked:

- Increase inventory for selected items
- Create inventory adjustment record

### If not checked:

- Inventory unchanged

🚨 **Refund alone never changes inventory**

---

## 6️⃣ Order status update (optional, conditional)

- If fully refunded AND not fulfilled:
  - You _may_ auto-cancel the order

- If fulfilled:
  - Keep order open or completed
  - Cancellation is optional

Shopify does **not force cancellation** on refund.

---

## 7️⃣ Generate refund document (important)

Generate:

- **Refund receipt** or **credit note**
- Includes:
  - Refund amount
  - Refunded items
  - Original order reference
  - Date

PDF optional but recommended (EU).

---

## 8️⃣ Send refund confirmation email

Email includes:

- Refunded amount
- Items refunded
- When customer will receive money
- Refund receipt (PDF or link)

---

## 9️⃣ Timeline / audit log

Log:

```text
Refund of €25.00 processed (manual). Inventory restocked.
```

This is crucial for support & accounting.

---

# Summary table (copy-safe logic)

| Step                 | Happens on refund |
| -------------------- | ----------------- |
| Money returned       | ✅                |
| Order deleted        | ❌                |
| Order canceled       | ❌ (optional)     |
| Inventory restocked  | ⬜ optional       |
| Refund doc generated | ✅                |
| Email sent           | ✅                |

---

# What refund should NOT do

❌ Do NOT:

- edit original invoice
- regenerate invoice
- unlock prices
- auto-restock fulfilled items
- auto-delete order

---

# How this fits your draft → paid model

- Draft orders ❌ cannot be refunded
- Only **paid orders** can be refunded
- Refund is a **post-payment financial event**

---
