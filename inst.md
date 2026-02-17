Exploring the eSewa payment and payout flow so we can outline a test plan and locate where the wait period is enforced.


[13 tools called]


Here’s a **step-by-step test plan** for the eSewa payment integration and how to **avoid the payout wait period** so the payout shows up for the admin right away.

---

## Prerequisites

- **Env:** `ESEWA_SECRET_KEY`, `ESEWA_PRODUCT_CODE` (e.g. `EPAYTEST` for sandbox), `NEXT_PUBLIC_APP_URL`, and any eSewa URLs your `lib/esewa` uses.
- **Two users:** one **seller** (has a store, will receive eSewa payout) and one **admin** (will complete the payout).
- **Seller store:** payout method set to **eSewa** and a valid **eSewa ID** in **Settings → Payments**.

---

## Part A: Skip the payout wait period (for testing)

Funds from eSewa orders go to **pending** balance and only become **available** after the hold period. To make them available immediately:

**Option 1 – Env (recommended for test runs)**

1. In `.env.local` set:
   ```bash
   HOLD_PERIOD_DAYS=0
   ```
2. Restart the app.  
   New eSewa payments will get `available_at = today`. The cron that moves pending → available uses `available_at <= now`, so they become available on the next cron run (or you can trigger it manually, see below).

**Option 2 – Make existing pending funds available (one-off)**

If you already have pending balance from earlier tests and don’t want to wait:

1. Run the hold-period cron once (if you have a way to call it with `CRON_SECRET`), **or**
2. In the DB, set `available_at` in the past so the next cron run will pick them up:
   ```sql
   UPDATE seller_balance_transactions
   SET available_at = NOW() - INTERVAL '1 minute'
   WHERE status = 'pending' AND type = 'order_payment';
   ```
3. Then trigger the cron (or wait for the next run).  
   The cron is in `app/api/cron/update-hold-periods/route.ts` and expects:
   ```bash
   Authorization: Bearer <CRON_SECRET>
   ```
   e.g. `curl -X POST https://your-app/api/cron/update-hold-periods -H "Authorization: Bearer YOUR_CRON_SECRET"`.

**Option 3 – Rely on `HOLD_PERIOD_DAYS=0` only**

With `HOLD_PERIOD_DAYS=0`, `available_at` is set to “now” when the eSewa callback runs. The cron compares `available_at <= now`; if the cron runs after that (or you run it manually), those transactions will be moved from pending to available in one go.

**Summary for “no wait” testing:** Set `HOLD_PERIOD_DAYS=0`, restart, then either run the update-hold-periods cron once after an eSewa payment or rely on your normal cron schedule.

---

## Part B: End-to-end test steps

### 1. Seller: Set payout method to eSewa

1. Log in as **seller**.
2. Go to **Settings → Payments**.
3. Choose **eSewa (Nepal)**.
4. Enter a test **eSewa ID** (e.g. sandbox ID).
5. Click **Save**.  
   → Confirms: payout method and eSewa ID are stored (eSewa ID is encrypted at rest).

### 2. Customer: Place an order and pay with eSewa

1. Log in as **customer** (or use guest if your checkout allows it).
2. Add product(s) from the **seller’s store** to cart.
3. Go to **checkout**.
4. Choose **eSewa** as payment method (your checkout UI must offer eSewa; e.g. `app/[locale]/checkout/page.tsx` around the `isEsewa` branch).
5. Fill billing/address and place order.  
   → Frontend calls `POST /api/esewa/init` with `orderIds`, `totalAmount`, `currency` (e.g. NPR), then redirects to eSewa with the returned form.
6. On eSewa (sandbox/live), complete payment.  
   → eSewa redirects to your **callback** with `status=success` and `ref=...`.
7. Your callback **GET /api/esewa/callback**:
   - Verifies (if you use `data`/`signature`).
   - Creates `order_payments` (provider `esewa`).
   - Calls `updateSellerBalance` for **order_payment** (and platform_fee).  
   → Funds go to seller’s **pending** balance with `available_at = now + HOLD_PERIOD_DAYS` (0 if you set the env above).
8. Order is marked **paid** and the user is redirected to the success URL.  
   → Confirms: payment recorded and seller balance updated.

### 3. Make balance “available” (if you use hold period)

- If **HOLD_PERIOD_DAYS=0**: run the **update-hold-periods** cron once (or wait for schedule).  
- If you didn’t set it to 0: run the SQL above to backdate `available_at`, then run the same cron.  
   → Confirms: pending → available; seller’s “Available balance” on Balance & Payouts increases.

### 4. Seller: Request payout (eSewa)

1. Log in as **seller**.
2. Go to **Finances → Balance & Payouts**.
3. Check:
   - Message says **“Payouts will be sent to your eSewa wallet (Nepal).”**
   - **Available balance** is enough (e.g. ≥ minimum, typically 20).
4. Click **Request Payout**.
5. In the dialog, confirm it shows **“Payout method: eSewa (Nepal)”**.
6. Enter amount (e.g. all available or above minimum), submit.  
   → Confirms: `requestPayout` creates a **pending** eSewa payout (no Stripe transfer). Seller sees success message.

### 5. Admin: See and complete the eSewa payout

1. Log in as **admin**.
2. Open **Finances → eSewa Payouts (Admin)** (sidebar; only visible to admin).  
   → Confirms: list of pending eSewa payouts with store name, amount, currency, **eSewa ID** (decrypted).
3. (Optional) Manually send the same amount from platform eSewa to the shown eSewa ID (real flow).
4. In the app, mark the payout as completed:
   - Either use the **Complete** (or equivalent) action in the UI on that payout row (if implemented), **or**
   - Call the API:
     ```bash
     POST /api/admin/payouts/<payoutId>/complete
     Authorization: (session cookie or Bearer as your app expects)
     ```
   → Confirms: `markEsewaPayoutCompleted` runs; payout status → completed and seller balance is debited.

### 6. Sanity checks after completion

- **Seller:** Finances → Payout History: the payout shows as **completed**.
- **Seller:** Balance decreased by the payout amount.
- **Admin:** eSewa Payouts (Admin): that payout no longer appears in “pending” (or is marked completed, depending on UI).

---

## Quick reference

| Step | Who    | Where / What |
|------|--------|---------------|
| 1    | Seller | Settings → Payments: eSewa + eSewa ID, Save |
| 2    | Customer | Checkout, pay with eSewa → callback runs, order paid, balance pending |
| 3    | System | `HOLD_PERIOD_DAYS=0` + run update-hold-periods cron → balance available |
| 4    | Seller | Finances → Balance & Payouts → Request Payout (eSewa), confirm dialog |
| 5    | Admin  | Finances → eSewa Payouts (Admin) → see payout + eSewa ID → Complete |
| 6    | Both  | Payout history and balance updated |

**To avoid payout wait in tests:** set **`HOLD_PERIOD_DAYS=0`** and run **POST /api/cron/update-hold-periods** (with `Authorization: Bearer <CRON_SECRET>`) once after an eSewa payment so the requested payout immediately uses the available balance and appears for the admin to complete.

