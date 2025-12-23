This is a **really important marketplace question**, and you’re right to pause here.
Eligibility is where **policy, trust, and data boundaries** meet — not just discounts.

I’ll break this down into:

1. **Core principle**
2. **Eligibility rules matrix (admin vs seller)**
3. **What sellers should and should NOT be allowed to do**
4. **What admins can do**
5. **UI wording & behavior**
6. **Backend enforcement rules**
7. **Edge cases you must handle**

No fluff — this is the stuff that prevents serious bugs later.

---

## 1. Core Principle (Anchor This)

> **Eligibility can never expand a discount beyond the discount owner’s authority.**

Meaning:

- Sellers can **restrict**, never **expand**
- Admins can **restrict or expand**

Eligibility is a **filter**, not a scope expander.

---

## 2. Eligibility Rules Matrix (Very Clear)

| Discount owner | Eligibility option | Allowed?     | Notes                               |
| -------------- | ------------------ | ------------ | ----------------------------------- |
| Seller         | All customers      | ✅           | Default                             |
| Seller         | Specific customers | ⚠️ Limited   | Only customers who bought from them |
| Seller         | Customer segments  | ❌           | Not yet (and often never)           |
| Admin          | All customers      | ✅           | Marketplace-wide                    |
| Admin          | Specific customers | ✅           | Any customer                        |
| Admin          | Segments           | 🚫 (for now) | Later                               |

---

## 3. Seller Eligibility: What You Must Restrict

### ❌ Sellers must NOT be allowed to:

- Target customers who never interacted with them
- Upload arbitrary customer IDs
- Target “VIP customers” across the marketplace
- Use eligibility to spy on customer lists

### ✅ Sellers MAY:

- Apply discounts to:
  - All customers
  - Customers who **have purchased from them before**
  - Customers explicitly assigned to them (if you support this)

This is critical for:

- Privacy
- GDPR
- Fair marketplace rules

---

## 4. Seller Eligibility – Correct Data Model

To enforce this cleanly, your system needs a concept of:

```
seller_customer_relationship
```

This does **not** need to be a table yet — it can be derived.

### Minimum viable rule (recommended)

> A seller can only target customers who have **at least one completed order** with that seller.

That’s it. Simple. Safe.

---

## 5. Admin Eligibility: Full Authority

Admins represent the platform, so they can:

- Target:
  - All customers
  - Any specific customers

- Override seller constraints (but not silently)

Admins should also be able to:

- Edit seller discounts **without widening eligibility**
- Convert a seller discount into an admin discount explicitly

---

## 6. UI Behavior (This Prevents Confusion)

### Seller Creating Discount

**Eligibility section**

```
Eligibility

○ All customers
○ Specific customers (customers who purchased from you)
```

Customer picker:

- Shows **only their customers**
- Copy explicitly says “your customers”

---

### Admin Creating Discount

**Eligibility section**

```
Eligibility

○ All customers
○ Specific customers
```

Customer picker:

- Shows **all marketplace customers**

---

### Admin Editing Seller Discount

UI copy must change:

```
Eligibility
Specific customers (from Seller XYZ’s customers)
```

Even if admin opens it.

This avoids accidental misuse.

---

## 7. Backend Enforcement (Non-Negotiable)

Never trust the UI.

### Eligibility check logic

```ts
function isCustomerEligible(
  discount: Discount,
  customerId: string | null,
  context: {
    isAdmin: boolean;
    sellerId?: string;
  }
): boolean {
  if (discount.customerEligibilityType === "all") {
    return true;
  }

  if (!customerId) return false;

  // Admin-owned discount
  if (discount.ownerType === "admin") {
    return discount.eligibleCustomerIds?.includes(customerId) ?? false;
  }

  // Seller-owned discount
  if (discount.ownerType === "seller") {
    // Ensure customer belongs to seller
    const isSellersCustomer = /* check order history */;
    if (!isSellersCustomer) return false;

    return discount.eligibleCustomerIds?.includes(customerId) ?? false;
  }

  return false;
}
```

This ensures:

- Seller discounts cannot leak
- Admin discounts stay powerful
- Admin edits don’t break scope

---

## 8. Very Important Edge Cases

### 1. Guest checkout

- Guest customers **cannot be eligible** for “specific customers”
- UI should warn:

  > “This discount requires a logged-in customer”

---

### 2. Customer deleted or anonymized

- Keep discount eligibility IDs
- If customer missing → ineligible silently

---

### 3. Multi-seller carts

- Eligibility is checked **per discount**, not per cart
- Seller discount can apply only to:
  - Seller’s products
  - Seller-eligible customer

---

### 4. Admin applying seller discount manually

- Must still pass seller eligibility rules
- Admin cannot force-apply seller discount to unrelated customer

This preserves seller trust.

---

## 9. What You Should NOT Do (Common Mistakes)

❌ Let sellers upload arbitrary customer IDs
❌ Let eligibility override product ownership
❌ Let admins silently widen seller discounts
❌ Treat eligibility as just UI logic

All eligibility rules must be enforced **server-side**.

---

## 10. Summary (Keep This Mental Model)

- **Owner defines authority**
- **Eligibility filters within that authority**
- **Sellers restrict, admins control**
- **UI explains scope, backend enforces it**
- **Never expand scope implicitly**

--

## 11. Make sure to do the following as well if not done already

- Update your **discount evaluator** with eligibility + ownership combined
- Design the **customer picker query logic** safely
- handle **guest checkout edge cases**
- Add **eligibility audit logs** (very useful later)
