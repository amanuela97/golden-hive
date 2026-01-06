Great — this is very doable, but there are **important realities** about EasyPost + Finland/Nepal that you should design around from day one. I’ll give you a **clean, production-grade blueprint**: tools, UI, backend logic, and country-specific constraints.

I’ll structure this as:

1. **Reality check: EasyPost + Finland & Nepal**
2. **Tools you’ll need (exact stack)**
3. **Recommended UI (seller-facing)**
4. **Backend logic (step-by-step)**
5. **Country-specific carrier strategy**
6. **How this fits your Stripe ledger**
7. **MVP vs production roadmap**

---

## 1. Reality check (very important)

### 🇫🇮 Finland

✅ **Domestic shipping**: possible
⚠️ **Carrier support is limited**

EasyPost **does NOT directly support Posti (Finland’s national carrier)**.

You have 3 realistic options:

1. **UPS / DHL / FedEx** via EasyPost → works internationally but expensive
2. **Bring Your Own Carrier (BYOC)** with Posti (advanced)
3. **Hybrid model** (recommended):
   - EasyPost for international
   - Manual / Posti integration for domestic Finland later

---

### 🇳🇵 Nepal

❌ **Domestic shipping via EasyPost: NOT supported**
⚠️ International only (DHL / FedEx)

Nepal has **no domestic EasyPost carriers**.
This means:

- You **cannot** auto-buy local labels in Nepal via EasyPost
- You **must fall back to manual shipping or 3rd-party local APIs**

👉 Etsy has the _same limitation_ in many countries.

---

### ✅ Conclusion

You **must design a system that supports both**:

- Auto-labels (EasyPost-supported routes)
- Manual shipping fallback

This is **normal and expected**.

---

## 2. Tools you will need

### Core

- **EasyPost API** (labels, rates, tracking)
- **Stripe Connect** (ledger & payouts)
- **Database ledger** (critical)
- **Address validation** (EasyPost does basic validation)

---

### Shipping Providers (recommended)

| Purpose              | Tool                   |
| -------------------- | ---------------------- |
| Shipping labels      | EasyPost               |
| Carrier fallback     | Manual upload          |
| Tracking sync        | EasyPost Webhooks      |
| Address autocomplete | Google Places / Mapbox |
| Currency handling    | Stripe                 |
| Tax/VAT (later)      | Stripe Tax / manual    |

---

## 3. Seller UI (Etsy-style, proven)

### Seller Order Page

**Section: Shipping**

```
Shipping Status: Not shipped

[ Buy Shipping Label ]
[ Mark as Shipped Manually ]
```

---

### When clicking “Buy Shipping Label”

#### Step 1: Address confirmation

```
From:
[ Seller warehouse address ]

To:
[ Buyer shipping address ]
```

✔ Editable
✔ Validated

---

#### Step 2: Package details

```
Weight: [ 1.2 ] kg
Length: [ 30 ] cm
Width:  [ 20 ] cm
Height: [ 10 ] cm
```

⚠️ Required for international shipping

---

#### Step 3: Available rates (dynamic)

```
Available shipping options:

( ) DHL Express – €42.30 – 2–4 days
( ) UPS Standard – €31.80 – 4–6 days
( ) FedEx Intl – €39.10 – 3–5 days

Shipping cost will be deducted from your balance.
```

✔ Clear cost disclosure
✔ Exactly what Etsy does

---

#### Step 4: Buy label

```
[ Buy label & mark as shipped ]
```

---

### Manual fallback UI

If EasyPost fails or country unsupported:

```
⚠️ Shipping labels not available for this route.

[ Enter tracking number manually ]
Carrier: [ Posti ]
Tracking number: [ _______ ]

[ Mark as shipped ]
```

---

## 4. Backend logic (the important part)

### Step 1: Create shipment (EasyPost)

```ts
const shipment = await easypost.Shipment.create({
  to_address: buyerAddress,
  from_address: sellerAddress,
  parcel: {
    weight: 1200,
    length: 30,
    width: 20,
    height: 10,
  },
});
```

---

### Step 2: Get rates

```ts
const rates = shipment.rates;
```

Filter by:

- allowed carriers
- max price
- delivery days

---

### Step 3: Seller selects rate → buy label

```ts
const boughtShipment = await shipment.buy({
  rate: selectedRate,
});
```

You receive:

- `label_url`
- `tracking_code`
- `rate.cost`

---

### Step 4: Pay carrier (platform money)

EasyPost charges **your EasyPost account**
You pay using **your platform Stripe account**

---

### Step 5: Ledger update (critical)

```ts
ledger.create({
  sellerId,
  type: "shipping_label",
  amount: -rate.cost,
  currency: "EUR",
  referenceId: shipment.id,
});
```

⚠️ Do NOT charge seller via Stripe directly
⚠️ Always update internal ledger

---

### Step 6: Mark order shipped

```ts
order.update({
  status: "shipped",
  trackingNumber,
  carrier,
  labelUrl,
});
```

---

### Step 7: Notify buyer

- Email
- Order page tracking link

---

## 5. Country-specific strategy (important)

### Finland 🇫🇮

**MVP**

- EasyPost → DHL / UPS / FedEx only
- Manual Posti fallback

**Later**

- BYOC with Posti
- Or custom Posti API integration

---

### Nepal 🇳🇵

**MVP**

- International only (DHL / FedEx)
- Domestic → manual only

**Later**

- Integrate local courier APIs directly
- Still keep manual fallback forever

---

## 6. Stripe ledger integration (how it fits)

Your ledger entry types:

```ts
type LedgerEntry =
  | "sale"
  | "platform_fee"
  | "stripe_fee"
  | "shipping_label"
  | "refund"
  | "adjustment";
```

Shipping label:

- Always a **negative seller balance**
- Never refunded automatically unless label refunded

---

## 7. MVP vs Production roadmap

### MVP (launch-ready)

✅ EasyPost test → prod
✅ International shipping only
✅ Manual fallback
✅ Ledger deductions
✅ Tracking sync

---

### Phase 2

- Posti (Finland) integration
- Local Nepal couriers
- Shipping presets (saved box sizes)
- Bulk label buying
- Auto-weight from product metadata

---

## Final advice (this matters)

If you try to make:

> “Shipping labels work everywhere automatically”

you **will fail or delay launch for months**.

Etsy, Shopify, eBay **all rely on manual fallbacks**.

✅ Build a **hybrid system**
✅ Make label buying a **convenience, not a requirement**
✅ Keep your ledger rock-solid

---

If you want next, I can:

- Design your **DB schema**
- Give you **EasyPost webhook handlers**
- Help you choose **carriers per country**
- Review your **exact checkout + shipping fee logic**

Just tell me what you want next.
What label_url actually is (EasyPost)

label_url is:

a URL hosted by EasyPost

that returns a downloadable file

usually PDF or PNG

So technically:

❌ Not an image blob
✅ A link to a file (PDF / PNG / ZPL)

Common label formats

When you buy a shipment, EasyPost generates the label in a format you choose or a default one.

Most common:
Format What it is Typical use
PDF Multi-page or single-page PDF Printing on A4
PNG Image file Preview in browser
ZPL Printer command language Thermal label printers

Example response:

{
"postage_label": {
"label_url": "https://easypost-files.s3.us-west-2.amazonaws.com/files/postage_label/20240101/abc123.pdf",
"label_file_type": "application/pdf"
}
}

How you should use it in your marketplace
✅ Store the URL, not the file

Best practice:

order.shippingLabel = {
labelUrl,
fileType,
carrier,
trackingCode,
};

Let EasyPost host the file unless you really need to store it yourself.

✅ Show a preview in UI
If PDF:
<a href={labelUrl} target="_blank">
Download shipping label (PDF)
</a>

or embed:

<iframe src={labelUrl} width="100%" height="600" />

If PNG:
<img src={labelUrl} alt="Shipping label" />

Can you choose the format?

Yes.

When buying a label:

shipment.buy({
rate,
label_format: "PDF", // or PNG, ZPL
});

(Some carriers only support certain formats.)

Important production notes (very important)

1. Label URLs can expire

EasyPost may expire or revoke URLs

Don’t assume lifetime access

👉 For important marketplaces:

Either proxy-download and rehost

Or allow re-generation via EasyPost

2. Never expose EasyPost API keys

label_url is safe to show

API calls must be server-side only
