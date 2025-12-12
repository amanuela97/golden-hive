Below is instruction on how to improve the CreateOrderForm, the word vendor is interchangeable with seller in this context and make sure to use server actions always instead of api route:

> **When the seller/admin manually types customer info on `/orders/new` and the email already exists in the customers table, what should happen?**

This updated version is designed so you can _copy/paste it directly into an AI agent_, fully self-contained.

---

# ✅ **FINAL UPDATED SPECIFICATION FOR `/orders/new` AND CUSTOMER AUTO-FILL LOGIC**

_(Includes new edge case handling)_

---

# 🎯 **Goal**

Allow admins and vendors to easily create orders using:

1. **Auto-filled customer information** from their own saved profile
2. **OR manually typed customer info** for creating an order on behalf of someone else

The system must:

- Respect vendor permissions
- Correctly create or reuse customers
- Avoid duplicate customer records
- Handle the edge case where manually entered email already exists in the database
- Auto-fill addresses using the `user` table and `shipping_billing_info`

---

# 🧱 **1. Customer Auto-Fill Behavior on `/orders/new`**

When loading the order creation page, the system checks:

```sql
SELECT * FROM customers WHERE userId = currentUser.id LIMIT 1;
```

### **Case A — Customer exists for this user**

→ Auto-fill the form with their existing customer record.

### **Case B — No customer exists for this user**

→ Create a customer using `users` table + `shipping_billing_info`:

- email
- first name
- last name
- phone
- shipping/billing fields

→ Insert into `customers`
→ Auto-fill using this new customer.

---

# 🧩 **2. UI Choice on `/orders/new`**

User sees:

### **Customer Source Selector**

```
(o) Use my saved customer info
( ) Enter customer info manually
```

- Selecting **Use my info** → auto-fill with saved profile
- Selecting **Manual entry** → clears fields, user types info manually

---

# 🔥 **3. CRITICAL EDGE CASE (NEW)**

### ❓ _What if the seller/admin manually enters customer info and the email already exists?_

This is the correct, Shopify-like handling:

---

## 🟩 Step 1 — When saving the order, check if the email exists:

```sql
SELECT * FROM customers WHERE email = inputCustomerEmail LIMIT 1;
```

There are **three possible outcomes**:

---

## **Outcome 1: Email exists AND belongs to _another_ customer**

(Meaning: user typed info for someone who is already a customer)

### → System should:

- **NOT create a new customer**
- **Use the existing customer record**
- **Ignore or overwrite the manually typed name/address**? Decision below 👇
- Link the order to that existing customer's ID

### How to handle name/address mismatch?

**BEST PRACTICE (Shopify-style)**
Use the manually typed name/address **only inside the order snapshot**, but **do not update the existing customer record**.

### Example:

A vendor types:

```
John Doe
john@example.com
123 Main Street
```

But `customers` table already has:

```
Customer ID 50
Email: john@example.com
Name: Jonathan Doe
Address: 88 Sunset Blvd
```

**System behavior:**

- Order → uses the _typed_ values (snapshot)
- Customer record → remains unchanged
- Order references `customerId = 50`

This avoids corrupting or overwriting real customer data.

---

## **Outcome 2: Email exists AND belongs to the same user (self-order)**

If admin/vendor manually types their own email again:

### → Use the existing customer record

### → Order snapshot fields use the typed values (if any difference)

No customer record change.

---

## **Outcome 3: Email does NOT exist in the customers table**

### → Create a new customer record using the manually entered fields

### → Link the order to this new customer

---

# 🟦 Summary of Edge Case Logic

| Condition                               | What System Should Do                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Email exists in customers table         | Use existing customerId, DO NOT update customer record, DO save typed values in order snapshot |
| Email exists and matches current userId | Use existing customerId, treat as self-order                                                   |
| Email does not exist                    | Create new customer record from typed fields                                                   |

This ensures:

- No duplicates
- Customer integrity is preserved
- Sellers can create orders on behalf of existing customers
- Orders always show correct data even if the customer record isn't updated

---

# 🔐 **4. Vendor vs Admin Permissions**

### Vendor:

- Can only select products where:

  ```
  listing.vendorId = currentUser.vendorId
  ```

- Has “Use My Info” option
- Can manually type info to create an order for _another_ customer

### Admin:

- Can use _any_ product
- Can use their own auto-fill
- Can manually enter for any customer
- Auto-matching customer emails works globally across marketplace

---

# 🏗️ **5. Customer Info Saved in Order (Snapshot Fields)**

Orders always save a copy of the customer info at the time of purchase:

- customerEmail
- customerFirstName
- customerLastName
- shipping name/address fields
- billing name/address fields

Regardless of whether customer exists or not.

This allows order history to remain accurate even if a customer later changes their profile.

---

# 🔄 **6. Full Customer Selection Logic (Copy-Paste for Agent)**

```
CUSTOMER SELECTION WORKFLOW
--------------------------------------------

When user visits /orders/new:
  1. Show toggle:
       (o) Use my saved customer info
       ( ) Enter customer info manually

  2. If "Use my saved customer info":
        - Check customers table WHERE customers.userId = currentUser.id
        - If exists → load customer into form
        - If not exists:
             - Create customer from user table + shipping_billing_info
             - Load into form

  3. If "Enter customer info manually":
        - Show empty fields
        - User fills:
            name, email, shipping, billing, etc.

        On submit:
            - Check customers.email = typedEmail

            CASE A: email exists → use existing customerId
                    - Snapshot order data uses typed values
                    - Do NOT update customer record

            CASE B: email exists and userId == currentUser.id
                    - Same as A (self-order case)
                    - Do NOT update customer record

            CASE C: email does not exist → create new customer row
                    - Insert manually typed values
                    - Link order to this new customerId
```

---

# 📦 **7. Example Scenario Walkthroughs**

## Scenario A – Vendor creating order for a new buyer

- Vendor selects “Manual entry”
- Types email that does not exist
- System creates new customer
- Order saved normally

## Scenario B – Vendor creating order for returning customer

- Vendor selects “Manual entry”
- Types email that already exists in customers table
- System:
  - Uses existing customerID
  - Saves order snapshot from typed info
  - Does NOT modify the existing customer record

## Scenario C – Admin wants to order for themself

- Admin selects “Use my info”
- Auto-populated from stored customer entry
- Order saved
