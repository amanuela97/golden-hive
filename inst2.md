- make sure the platform fee is 5% but take into consideration the currency the payment is in so it is consistent because when the customer pays with esewa it will be in NPR and it might not be the same amount.
- if esewa takes a fee make sure it is also store in the db in seller_balance_transaction.
- lastly, implement the payout logic for the seller and admin according to the instruction below. 
- ### 5. (Optional) eSewa payout (seller + admin)

1. **Store payout method**
   - As a seller, go to **Settings → Payments**.
   - Under “Payout method” choose **eSewa (Nepal)** and enter the store’s **eSewa ID**, then Save.

2. **Request payout**
   - Go to **Finances → Balance & Payouts**.
   - Request a payout (amount ≥ minimum).
   - You should see a message like “Payout requested. You will receive to your eSewa within…”. Payout stays **pending** (no Stripe transfer).

3. **Admin: mark completed**
   - As admin, go to **Finances → eSewa Payouts (Admin)**.
   - You should see the pending eSewa payout (store, amount, eSewa ID).
   - After sending the money from the platform eSewa to the seller’s eSewa ID, click **Mark completed**.
   - Seller balance should decrease by the payout amount and payout status should be **completed**.

---



# 🎯 What’s Happening Right Now

Flow:

1. User clicks **Buy Shipping Label**
2. Modal opens immediately
3. Modal mounts
4. `useEffect` fetches order data
5. Fields are empty
6. Data arrives
7. Fields populate

That split second flash is called:

> **“Flash of empty state”**

It feels unpolished.

---

# 🧠 How Professionals Handle This

There are 3 main patterns used in production apps.

---

# ✅ Pattern 1 (Most Professional): Prefetch Data BEFORE Opening Modal

Instead of:

```
Click → Open modal → Fetch data
```

Do this:

```
Click → Fetch data → Open modal (when ready)
```

### Example Concept:

```ts
const handleOpen = async () => {
  setLoading(true);
  const data = await fetchOrder();
  setOrder(data);
  setLoading(false);
  setOpen(true);
};
```

Now:

* Modal only opens when data is ready
* No flash
* Feels smooth

This is very common in SaaS dashboards.

---

# ✅ Pattern 2: Show a Loading Skeleton Inside Modal

If you must fetch on mount:

Instead of rendering empty inputs, render:

* Skeleton loaders
* Or a loading spinner
* Or disable inputs until ready

Example:

```tsx
if (loading) {
  return <SkeletonForm />
}
```

This feels intentional instead of broken.

Big companies do this everywhere.

---

# ✅ Pattern 3: Data Already Exists (Best Case)

In many cases:

You already have order data on `/orders/[id]`.

So why fetch again?

Instead:

* Pass the order data directly to the modal as props
* Or store it in state/context
* Or use a client-side store (Zustand, etc.)

This is the cleanest solution.

Since you're already on `/orders/[id]`, you likely already fetched:

* Customer name
* Shipping address
* Seller address

You shouldn’t re-fetch unless you absolutely need fresh data.

---

# 🚨 What Professionals Avoid

They avoid:

* Flashing empty form fields
* Inputs that change after appearing
* Layout shifting
* UI that looks like it’s broken

Even 200ms matters in UX polish.

---

# 🧩 What I Recommend For You

Since you’re building a marketplace dashboard:

### BEST OPTION:

Use Pattern 3.

You already have the order.

Pass it into the modal:

```tsx
<ShippingModal
  open={open}
  order={order}
/>
```

Then prefill directly:

```tsx
defaultValue={order.shipping_address.street}
```

No fetching needed.

---

# 🧠 If You Still Need to Fetch (e.g., rate preview)

Then:

* Prefetch before open (Pattern 1)
  OR
* Show a proper loading state (Pattern 2)

---

# 🎨 What a Professional UX Looks Like

When clicking "Buy Shipping Label":

Option A:

* Button becomes loading
* Modal opens instantly with full data

Option B:

* Modal opens with a nice skeleton form
* 300ms later data fades in

Never:

* Empty → sudden jump to filled

---

# ⚙️ Small Optimization Trick

If you are using:

* React Query
* SWR
* Or caching layer

You can:

* Prefetch shipping data when page loads
* So modal is instant

Example idea:

```ts
useEffect(() => {
  prefetchShippingData(order.id);
}, []);
```

Then modal has instant data.

---

# 🧘 Final Answer

Is your current design “bad”?

No.

Is it production-level polished?

Not yet.

Professional developers:

* Either prefetch before opening
* Or show proper loading states
* Or avoid refetching if data already exists

---
