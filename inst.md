Checking the eSewa flow and env requirements so we can provide accurate testing steps:


[5 tools called]


Here are step-by-step instructions you can paste into `inst.md`. (I'm in Ask mode, so I can't edit the file myself.)

---

## Step-by-step: Testing eSewa integration

### 1. Environment

- In `.env.local` set at least:
  - `ESEWA_SECRET_KEY` (your Epay-v2 secret, e.g. `"8gBm/:&EnhH.1/q"`).
- Optional:
  - `ESEWA_PRODUCT_CODE=EPAYTEST` (defaults to `EPAYTEST` if omitted).
  - `ESEWA_ENV=test` (defaults to test; use `production` only for live).
- Set **`NEXT_PUBLIC_APP_URL`** to the URL where your app is reachable (see step 2).  
  Example for local: `http://localhost:3000`.  
  Example with tunnel: `https://your-ngrok-url.ngrok.io`.

Restart the dev server after changing env.

---

### 2. Callback URL must be reachable by eSewa

eSewa redirects the customer to your callback (`/api/esewa/callback?...`). That request goes from **eSewa’s servers** to your app, so:

- **Local:** `http://localhost:3000` only works if eSewa can reach it. Usually it cannot, so use a tunnel:
  - Run the app: `npm run dev`.
  - Expose it with ngrok (or similar):  
    `ngrok http 3000`
  - Set `NEXT_PUBLIC_APP_URL=https://<your-ngrok-host>` in `.env.local` and restart.
- **Staging/production:** Use the real app URL (e.g. `https://yourdomain.com`) and set `NEXT_PUBLIC_APP_URL` to that.

---

### 3. Payment flow (customer)

1. **Cart**
   - Add at least one product to the cart.

2. **Checkout**
   - Go to checkout.
   - Fill billing (and shipping if needed).
   - **Set Billing country to Nepal (NP).**
   - In “Payment method” you should see **“eSewa (Nepal)”**; select it.
   - Choose a shipping method if required, then click **Place Order**.

3. **Redirect to eSewa**
   - You should be sent to eSewa (test: `rc-epay.esewa.com.np`).
   - Complete payment there (use eSewa test credentials/wallet if it’s test).

4. **Back to your app**
   - eSewa redirects to your callback; the app then redirects to:
   - `/checkout/success?orderIds=...`
   - You should see the success page and order details.

---

### 4. Verify payment and ledger

- **Order:** In dashboard (or DB), the order should be **paid** and have **payment status “paid”**.
- **Order payment:** There should be an `order_payments` row with `provider = 'esewa'` for that order.
- **Balance:** Seller balance should show:
  - Credit for the order amount.
  - Debit for the 5% platform fee (no Stripe fee for eSewa).

---

### 5. (Optional) eSewa payout (seller + admin)

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

### 6. Quick checklist

- [ ] `ESEWA_SECRET_KEY` set; server restarted.
- [ ] `NEXT_PUBLIC_APP_URL` set to a URL eSewa can reach (tunnel or real host).
- [ ] Checkout with country **NP** and payment method **eSewa**.
- [ ] Redirect to eSewa and complete payment (test wallet if test env).
- [ ] Redirect back to `/checkout/success?orderIds=...`.
- [ ] Order is paid; `order_payments.provider = 'esewa'`; balance updated.
- [ ] (Optional) Store set to eSewa payout; request payout; admin marks completed and balance debits.

---

If you want this written directly into `inst.md` for you, switch to **Agent mode** and ask to “write the eSewa testing steps into inst.md”.