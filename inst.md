Below is a **COMPLETE** Customer Management Page Specification — including **explicit handling** of the case where **multiple vendors have customers with the same email**.

---

# ✅ **CUSTOMERS MANAGEMENT SYSTEM — FULL SPEC (WITH MULTI-VENDOR EMAIL HANDLING)**

This specification defines everything required to build a **Shopify-like Customer Management Page** for your multi-vendor marketplace, including:

- Vendor vs Admin permissions
- How to store customers when multiple vendors share the same email
- Full list, search, sort, pagination
- Customer detail page + order history
- Creating & editing customers
- Backend API structure
- Preventing vendor data conflicts
- Future-proofing

---

# 1. **SCHEMA RECAP & REQUIRED BEHAVIOR**

Your `customers` table includes fields:

```
id (uuid)
vendorId (uuid, nullable) — identifies which vendor owns this customer
userId (text, nullable) — links the customer to a user account (for autofill)
email (text)
firstName (text)
lastName (text)
phone (text)
address fields…
notes (text)
createdAt
updatedAt
```

Your `orders` table references:

```
customerId → customers.id
```

### 🔥 **IMPORTANT Multi-Vendor Rule**

Two different vendors **can** have customers with the same email.

But each vendor must have **their own separate customer record** so they can edit customer info without affecting other vendors.

### Add uniqueness constraint:

```
UNIQUE (vendorId, email)
```

This ensures:

- Vendor A’s customer `john@example.com`
- Vendor B’s customer `john@example.com`
- … are separate records with independent data.

Admin customers (vendorId = NULL) may also exist.

---

# 2. **ROLE PERMISSIONS**

### 🟩 **Admin**:

- Can view **all customers** in marketplace
- Can filter by vendor
- Can edit any customer
- Can view all orders made by that customer (across all vendors)

### 🟦 **Vendor/Seller**:

- Can view **only customers where `vendorId = currentVendorId`**
- Cannot view other vendors' customers (privacy/security)
- Can edit only their own customers
- Customer order history is limited to orders attached to their own vendor products
- Cannot modify global/admin-level customers

---

# 3. **CUSTOMER PAGE URLs**

| Page            | URL                            |
| --------------- | ------------------------------ |
| Customer List   | `/customers`                   |
| New Customer    | `/customers/new`               |
| Customer Detail | `/customers/[customerId]`      |
| Edit Customer   | `/customers/[customerId]/edit` |

---

# 4. **CUSTOMERS INDEX PAGE (`/customers`)**

## 4.1 Header

```
Title: Customers
Button: Add Customer → /customers/new
```

**Admin sees:**

- Vendor filter dropdown (“All vendors”, “Vendor A”, “Vendor B”, …)

**Vendors DO NOT see this filter.**

---

## 4.2 Filters Section

- **Search bar** → filters:
  - firstName
  - lastName
  - email
  - phone

- **Sort dropdown**:
  - Newest customers
  - Oldest customers
  - Highest total spend
  - Most orders
  - Name A–Z
  - Name Z–A

- **Date range filter (optional)**

---

## 4.3 Customers Table Columns

| Column      | Description                                            |
| ----------- | ------------------------------------------------------ |
| Customer    | Name, email, phone                                     |
| Total Spent | SUM(orders.totalAmount) restricted to vendor if vendor |
| Orders      | COUNT(orders.id)                                       |
| Last Order  | MAX(orders.createdAt) (formatDistanceToNow)            |
| Created At  | Customer created date                                  |

### Backend SQL logic (grouping + aggregates):

```
SELECT customers.*,
       COUNT(orders.id) AS ordersCount,
       COALESCE(SUM(orders.totalAmount), 0) AS totalSpent,
       MAX(orders.createdAt) AS lastOrderDate
FROM customers
LEFT JOIN orders ON orders.customerId = customers.id
WHERE
  IF vendor → customers.vendorId = currentVendorId
  IF admin → vendorId matches filter or all
  AND matches search
GROUP BY customers.id
ORDER BY selectedSort
LIMIT pageSize OFFSET page * pageSize
```

---

# 5. **NEW CUSTOMER CREATION (`/customers/new`)**

Form fields:

- First Name
- Last Name
- Email (required)
- Phone
- Shipping address
- Billing address
- Notes
- Admin only → Vendor selector (for which vendor the customer belongs to)

### Saving:

- If vendor is creating:

  ```
  vendorId = currentVendorId
  ```

- If admin is creating:
  - If vendor is selected → assign vendorId
  - If no vendor is selected → vendorId = NULL (global customer)

### Multi-vendor rule:

Before creating a new customer:

```
Check if (email, vendorId) already exists:
SELECT * FROM customers WHERE email = input.email AND vendorId = currentVendorId
```

- If exists → return error: "Customer with this email already exists for your store"
- If not → create customer

This prevents a vendor from accidentally making duplicates for themselves while still allowing other vendors to reuse the same email.

---

# 6. **CUSTOMER DETAIL PAGE (`/customers/[id]`)**

Layout sections:

## 6.1 Header

- Customer Name
- Email
- Phone
- Buttons:
  - **Edit** (vendor/admin only if belongs to them)
  - **Delete** (admin only)

---

## 6.2 Contact Information Section

Displays:

- Email
- Phone
- Shipping address
- Billing address
- Notes

---

## 6.3 Statistics

Show computed metrics (scoped by vendor):

- Total Spent
- Total Orders
- First Order Date
- Last Order Date
- Average Order Value

---

## 6.4 Order History Table

Columns:

- Order Number
- Date
- Payment Status
- Fulfillment Status
- Total Amount
- Item Count

**Vendor:** Only sees orders for that vendor's products.
**Admin:** Sees all orders for that customer.

---

# 7. **EDIT CUSTOMER (`/customers/[id]/edit`)**

Editable fields:

- First Name
- Last Name
- Email
- Phone
- Addresses
- Notes

### Multi-vendor rule applies here too:

Vendors can only edit customers:

```
WHERE customer.vendorId = currentVendorId
```

Admin can edit all customers.

---

# 8. **ORDER CREATION & CUSTOMER SELECTION INTEGRATION**

On `/orders/new`, customer selection must ORIGINATE from the customers table.

There are **two main methods**:

---

## 🟢 Method 1 — Search for existing customer

You provide:

- Search box → finds customers for this vendor (`vendorId = currentVendorId`)
- Selecting a customer autofills their info into the order

Vendor only sees their own customers.
Admin sees all.

---

## 🔵 Method 2 — Manual entry (typed email)

### MULTI-VENDOR EMAIL HANDLING (IMPORTANT)

When admin or vendor types an email manually:

```
Check if customer exists with SAME email AND SAME vendorId:
  SELECT * FROM customers WHERE email = input.email AND vendorId = currentVendorId LIMIT 1
```

### Case A — Found a match for same vendor

→ Use that customerId
→ Fill order snapshot with manually-typed info
→ Do NOT update the customer record unless edited separately

### Case B — Email exists under a DIFFERENT vendor

Example:

- Vendor A types email `john@example.com`
- But Vendor B already has a customer with that email

**Vendor A MUST NOT reuse Vendor B’s customer record.**

Instead:
✓ Create a _new customer_ for Vendor A with that email
✓ Save order under Vendor A’s new customer
✓ No conflict occurs

This ensures complete vendor isolation.

### Case C — No customer exists at all

→ Create new customer for this vendor with the typed email
→ Use them for the order

---

# 9. **CUSTOMER RECORD ISOLATION LOGIC**

This MUST be enforced everywhere:

```
A vendor can only read, edit, or use customers WHERE customer.vendorId = currentVendorId.
An admin can read/edit/use all customers.
Duplicate emails across different vendors are allowed and safe.
```

---

# 10. **BACKEND ENDPOINTS**

Implement:

### `GET /api/customers`

- list view with search, sort, pagination

### `POST /api/customers`

- create customer with vendorId scoping
- reject duplicates within same vendor

### `GET /api/customers/[id]`

- fetch detail page

### `PUT /api/customers/[id]`

- update customer (vendor or admin only)

### `DELETE /api/customers/[id]`

- admin only

### Utility:

`GET /api/customers/search?query=x`

- for selecting customers inside `/orders/new`

---

# 11. **IMPLEMENTATION CHECKLIST**

### Backend

- [ ] Verify uniqueness constraint `(vendorId, email)`
- [ ] Ensure vendor isolation
- [ ] Implement filters + search + sorts
- [ ] Implement aggregated computed fields

### UI

- [ ] Customers list page
- [ ] Customer detail
- [ ] Customer create
- [ ] Customer edit
- [ ] Customer delete (admin)

### Orders Integration

- [ ] Customer search modal
- [ ] Manual entry with multi-vendor-safe logic
- [ ] Auto-fill customer info
- [ ] Automatically create customer on order creation if needed

---

# 🎉 DONE — THIS IS THE COMPLETE SPEC

This version includes:

✔ Full customers module
✔ Multivendor email handling
✔ Correct linking between orders & customers
✔ Vendor isolation rules
✔ Admin full access
✔ Duplicate email safety logic
✔ UI, backend, and data flow instructions
