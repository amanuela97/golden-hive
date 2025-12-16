Updating the implementation instructions to include token-based payment and Stripe Checkout with Connect.

[3 tools called]

## Updated Implementation Instructions: Send Invoice & Mark as Paid with Stripe Connect

### Overview

Two features for draft orders:

1. Send Invoice: Generate a secure token, email an invoice with a payment link, and create a public payment page
2. Mark as Paid: Manual payment marking (for non-Stripe payments)

Includes Stripe Checkout with Connect (Destination Charges) for automatic payment processing with a 5% platform fee.

---

### Part 1: Database Schema Updates

#### 1.1 Update `draftOrders` Table

Add invoice token and expiration fields:

```typescript
// In db/schema.ts, update draftOrders table:
export const draftOrders = pgTable("draft_orders", {
  // ... existing fields ...
  invoiceToken: text("invoice_token").unique(), // Secure token for payment link
  invoiceExpiresAt: timestamp("invoice_expires_at"), // Token expiration (e.g., 30 days)
  invoiceSentAt: timestamp("invoice_sent_at"), // Track when invoice was sent
  invoiceSentCount: integer("invoice_sent_count").default(0), // How many times sent
  // ... rest of fields ...
});
```

#### 1.2 Update `store` Table

Add Stripe Connect account ID:

```typescript
// In db/schema.ts, update store table:
export const store = pgTable("store", {
  // ... existing fields ...
  stripeAccountId: text("stripe_account_id"), // Stripe Connect account ID
  // ... rest of fields ...
});
```

#### 1.3 Update `orderPayments` Table

Add platform fee tracking:

```typescript
// In db/schema.ts, update orderPayments table:
export const orderPayments = pgTable("order_payments", {
  // ... existing fields ...
  platformFeeAmount: numeric("platform_fee_amount", {
    precision: 10,
    scale: 2,
  }), // 5% platform fee
  netAmountToStore: numeric("net_amount_to_store", { precision: 10, scale: 2 }), // Amount store receives
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe PaymentIntent ID
  stripeCheckoutSessionId: text("stripe_checkout_session_id"), // Stripe Checkout Session ID
  // ... rest of fields ...
});
```

Create migration:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

### Part 2: Stripe Setup

#### 2.1 Install Stripe (Already Done)

Stripe is already in `package.json`. Set up environment variables:

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # For webhook verification
```

#### 2.2 Create Stripe Client Utility

Create `lib/stripe.ts`:

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});
```

---

### Part 3: Token Generation & Email Template

#### 3.1 Create Token Generation Utility

Create `lib/invoice-token.ts`:

```typescript
import { nanoid } from "nanoid";

/**
 * Generate a secure token for invoice payment links
 */
export function generateInvoiceToken(): string {
  // Generate a URL-safe token (32 characters)
  return nanoid(32);
}

/**
 * Calculate invoice expiration date (default: 30 days)
 */
export function getInvoiceExpirationDate(days: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
```

#### 3.2 Update Invoice Email Template

Update `app/[locale]/components/draft-invoice-email.tsx`:

```typescript
interface DraftInvoiceEmailProps {
  draftNumber: number;
  customerName: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  total: string;
  currency: string;
  paymentUrl: string; // Now uses token-based URL
  customMessage?: string;
  expiresAt?: Date;
}

export default function DraftInvoiceEmail({
  draftNumber,
  customerName,
  items,
  subtotal,
  total,
  currency,
  paymentUrl,
  customMessage,
  expiresAt,
}: DraftInvoiceEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#333' }}>Invoice #{draftNumber}</h1>

      <p>Dear {customerName},</p>

      {customMessage && (
        <div style={{ background: '#f5f5f5', padding: '15px', margin: '20px 0', borderRadius: '5px' }}>
          <p style={{ margin: 0 }}>{customMessage}</p>
        </div>
      )}

      <h2>Order Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Item</th>
            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Qty</th>
            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Price</th>
            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.title}</td>
              <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
              <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{item.unitPrice} {currency}</td>
              <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{item.lineTotal} {currency}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }}>Total:</td>
            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }}>{total} {currency}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <a
          href={paymentUrl}
          style={{
            display: 'inline-block',
            padding: '15px 30px',
            background: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}
        >
          Pay Now
        </a>
      </div>

      {expiresAt && (
        <p style={{ color: '#666', fontSize: '12px', marginTop: '20px' }}>
          This invoice expires on {expiresAt.toLocaleDateString()}.
        </p>
      )}

      <p style={{ color: '#666', fontSize: '12px', marginTop: '30px' }}>
        This is an invoice for draft order #{draftNumber}. Please click the button above to complete your payment securely.
      </p>
    </div>
  );
}
```

---

### Part 4: Server Actions Implementation

#### 4.1 Update `sendInvoice` Function

Update `app/[locale]/actions/draft-orders.ts`:

```typescript
import resend from "@/lib/resend";
import DraftInvoiceEmail from "@/app/[locale]/components/draft-invoice-email";
import {
  generateInvoiceToken,
  getInvoiceExpirationDate,
} from "@/lib/invoice-token";

export async function sendInvoice(
  draftId: string,
  email: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    // Validate draftId
    if (!draftId || typeof draftId !== "string" || draftId.length !== 36) {
      return { success: false, error: "Invalid draft ID" };
    }

    // Get full draft order with items
    const draftResult = await getDraftOrder(draftId);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Draft order not found",
      };
    }

    const draft = draftResult.data;

    // Check if draft is completed
    if (draft.completed) {
      return { success: false, error: "Draft order is already completed" };
    }

    // Check permissions
    if (!isAdmin && draft.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to send invoice for this draft order",
      };
    }

    // Validate email
    if (!email || !email.includes("@")) {
      return { success: false, error: "Invalid email address" };
    }

    // Generate secure token and expiration
    const invoiceToken = generateInvoiceToken();
    const expiresAt = getInvoiceExpirationDate(30); // 30 days

    // Generate payment URL using token
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceToken}`;

    // Prepare email data
    const customerName =
      draft.customerFirstName && draft.customerLastName
        ? `${draft.customerFirstName} ${draft.customerLastName}`
        : draft.customerEmail || "Customer";

    // Send email using Resend
    const emailResult = await resend.emails.send({
      from: "Golden Hive <goldenhive@resend.dev>", // Update with your domain
      to: email,
      subject: `Invoice #${draft.draftNumber} - Payment Required`,
      react: DraftInvoiceEmail({
        draftNumber: draft.draftNumber,
        customerName,
        items: draft.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal: draft.subtotalAmount,
        total: draft.totalAmount,
        currency: draft.currency,
        paymentUrl,
        customMessage: message,
        expiresAt,
      }),
    });

    if (emailResult.error) {
      return {
        success: false,
        error: `Failed to send email: ${emailResult.error.message}`,
      };
    }

    // Update draft order with token and tracking
    await db
      .update(draftOrders)
      .set({
        invoiceToken: invoiceToken,
        invoiceExpiresAt: expiresAt,
        invoiceSentAt: new Date(),
        invoiceSentCount: sql`${draftOrders.invoiceSentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(draftOrders.id, draftId));

    return { success: true };
  } catch (error) {
    console.error("Error sending invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invoice",
    };
  }
}
```

#### 4.2 Create Public Invoice Payment Page Server Action

Create `app/[locale]/actions/invoice-payment.ts`:

```typescript
"use server";

import { db } from "@/db";
import { draftOrders, store } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * Get draft order by invoice token (public access)
 */
export async function getDraftOrderByToken(token: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    draftNumber: number;
    totalAmount: string;
    currency: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    items: Array<{
      title: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
    storeId: string | null;
  };
  error?: string;
}> {
  try {
    if (!token || typeof token !== "string") {
      return { success: false, error: "Invalid token" };
    }

    // Get draft order with token validation
    const draftData = await db
      .select({
        id: draftOrders.id,
        draftNumber: draftOrders.draftNumber,
        totalAmount: draftOrders.totalAmount,
        currency: draftOrders.currency,
        customerEmail: draftOrders.customerEmail,
        customerFirstName: draftOrders.customerFirstName,
        customerLastName: draftOrders.customerLastName,
        paymentStatus: draftOrders.paymentStatus,
        completed: draftOrders.completed,
        invoiceExpiresAt: draftOrders.invoiceExpiresAt,
        storeId: draftOrders.storeId,
      })
      .from(draftOrders)
      .where(
        and(
          eq(draftOrders.invoiceToken, token),
          eq(draftOrders.completed, false),
          eq(draftOrders.paymentStatus, "pending")
        )
      )
      .limit(1);

    if (draftData.length === 0) {
      return { success: false, error: "Invoice not found or already paid" };
    }

    const draft = draftData[0];

    // Check expiration
    if (
      draft.invoiceExpiresAt &&
      new Date(draft.invoiceExpiresAt) < new Date()
    ) {
      return { success: false, error: "This invoice has expired" };
    }

    // Get draft items
    const items = await db
      .select({
        title: draftOrderItems.title,
        quantity: draftOrderItems.quantity,
        unitPrice: draftOrderItems.unitPrice,
        lineTotal: draftOrderItems.lineTotal,
      })
      .from(draftOrderItems)
      .where(eq(draftOrderItems.draftOrderId, draft.id));

    return {
      success: true,
      data: {
        id: draft.id,
        draftNumber: Number(draft.draftNumber),
        totalAmount: draft.totalAmount,
        currency: draft.currency,
        customerEmail: draft.customerEmail,
        customerFirstName: draft.customerFirstName,
        customerLastName: draft.customerLastName,
        items: items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        storeId: draft.storeId,
      },
    };
  } catch (error) {
    console.error("Error fetching draft order by token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoice",
    };
  }
}

/**
 * Create Stripe Checkout Session for invoice payment
 */
export async function createInvoiceCheckoutSession(token: string): Promise<{
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}> {
  try {
    // Get draft order by token
    const draftResult = await getDraftOrderByToken(token);
    if (!draftResult.success || !draftResult.data) {
      return {
        success: false,
        error: draftResult.error || "Invoice not found",
      };
    }

    const draft = draftResult.data;

    // Get store with Stripe account ID
    if (!draft.storeId) {
      return { success: false, error: "Store not found for this invoice" };
    }

    const storeData = await db
      .select({
        id: store.id,
        stripeAccountId: store.stripeAccountId,
        storeName: store.storeName,
      })
      .from(store)
      .where(eq(store.id, draft.storeId))
      .limit(1);

    if (storeData.length === 0) {
      return { success: false, error: "Store not found" };
    }

    const storeInfo = storeData[0];

    if (!storeInfo.stripeAccountId) {
      return {
        success: false,
        error:
          "Store has not connected Stripe account. Please contact support.",
      };
    }

    // Calculate amounts (convert to cents)
    const totalAmountCents = Math.round(parseFloat(draft.totalAmount) * 100);
    const platformFeeCents = Math.round(totalAmountCents * 0.05); // 5% platform fee

    // Create Stripe Checkout Session with Connect (Destination Charges)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: draft.currency.toLowerCase(),
            unit_amount: totalAmountCents,
            product_data: {
              name: `Invoice #${draft.draftNumber}`,
              description: `Payment for draft order #${draft.draftNumber}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents, // Your 5% platform fee
        on_behalf_of: storeInfo.stripeAccountId, // Compliance & reporting
        transfer_data: {
          destination: storeInfo.stripeAccountId, // Store receives the rest
        },
        metadata: {
          draftId: draft.id,
          storeId: storeInfo.id,
          invoiceToken: token,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${token}?canceled=true`,
      customer_email: draft.customerEmail || undefined,
      metadata: {
        draftId: draft.id,
        storeId: storeInfo.id,
        invoiceToken: token,
      },
    });

    return {
      success: true,
      checkoutUrl: checkoutSession.url || undefined,
    };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create checkout session",
    };
  }
}
```

---

### Part 5: Public Payment Pages

#### 5.1 Create Invoice Payment Page

Create `app/[locale]/pay/invoice/[token]/page.tsx`:

```typescript
import { getDraftOrderByToken, createInvoiceCheckoutSession } from "@/app/[locale]/actions/invoice-payment";
import { redirect } from "next/navigation";
import InvoicePaymentPageClient from "./InvoicePaymentPageClient";

interface InvoicePaymentPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
}

export default async function InvoicePaymentPage({
  params,
  searchParams,
}: InvoicePaymentPageProps) {
  const { token } = await params;
  const { canceled } = await searchParams;

  // Get draft order by token
  const draftResult = await getDraftOrderByToken(token);

  if (!draftResult.success || !draftResult.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invoice Not Found</h1>
          <p className="text-muted-foreground">
            {draftResult.error || "This invoice link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <InvoicePaymentPageClient
      draftData={draftResult.data}
      token={token}
      canceled={canceled === "true"}
    />
  );
}
```

#### 5.2 Create Invoice Payment Client Component

Create `app/[locale]/pay/invoice/[token]/InvoicePaymentPageClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, AlertCircle } from "lucide-react";
import { createInvoiceCheckoutSession } from "@/app/[locale]/actions/invoice-payment";
import toast from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoicePaymentPageClientProps {
  draftData: {
    id: string;
    draftNumber: number;
    totalAmount: string;
    currency: string;
    customerEmail: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    items: Array<{
      title: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
  };
  token: string;
  canceled: boolean;
}

export default function InvoicePaymentPageClient({
  draftData,
  token,
  canceled,
}: InvoicePaymentPageClientProps) {
  const [loading, setLoading] = useState(false);

  const handlePayNow = async () => {
    setLoading(true);
    try {
      const result = await createInvoiceCheckoutSession(token);
      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || "Failed to create payment session");
      }
    } catch (error) {
      toast.error("Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const customerName =
    draftData.customerFirstName && draftData.customerLastName
      ? `${draftData.customerFirstName} ${draftData.customerLastName}`
      : draftData.customerEmail || "Customer";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Invoice #{draftData.draftNumber}</CardTitle>
            {canceled && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment was canceled. You can try again below.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Bill To:</p>
              <p className="font-medium">{customerName}</p>
              {draftData.customerEmail && (
                <p className="text-sm text-muted-foreground">
                  {draftData.customerEmail}
                </p>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-2">
                {draftData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × {item.unitPrice}{" "}
                        {draftData.currency}
                      </p>
                    </div>
                    <p className="font-medium">
                      {item.lineTotal} {draftData.currency}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-2xl font-bold">
                {draftData.totalAmount} {draftData.currency}
              </span>
            </div>

            <Button
              onClick={handlePayNow}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {loading ? "Processing..." : "Pay Now"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment powered by Stripe
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

#### 5.3 Create Success Page

Create `app/[locale]/pay/success/page.tsx`:

```typescript
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Payment Successful!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Thank you for your payment. Your order has been processed and you
              will receive a confirmation email shortly.
            </p>
            <Button asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### Part 6: Stripe Webhook Handler

#### 6.1 Create Webhook Route

Create `app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import {
  draftOrders,
  orders,
  orderItems,
  draftOrderItems,
  orderEvents,
  orderPayments,
  store,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { completeDraftOrder } from "@/app/[locale]/actions/draft-orders";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;

    if (!metadata || !metadata.draftId) {
      console.error("Missing draftId in metadata");
      return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
    }

    const draftId = metadata.draftId;
    const storeId = metadata.storeId;

    try {
      // Get payment intent to calculate fees
      const paymentIntentId = session.payment_intent as string;
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);

      // Calculate amounts
      const totalAmount = (paymentIntent.amount / 100).toFixed(2);
      const applicationFeeAmount = paymentIntent.application_fee_amount
        ? (paymentIntent.application_fee_amount / 100).toFixed(2)
        : "0";
      const netAmountToStore = (
        (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) /
        100
      ).toFixed(2);

      // Get draft order
      const draftResult = await getDraftOrder(draftId);
      if (!draftResult.success || !draftResult.data) {
        console.error("Draft order not found:", draftId);
        return NextResponse.json(
          { error: "Draft order not found" },
          { status: 404 }
        );
      }

      const draft = draftResult.data;

      // Complete the draft order (convert to order)
      const completeResult = await completeDraftOrder(draftId, true); // markAsPaid = true

      if (!completeResult.success) {
        console.error("Failed to complete draft order:", completeResult.error);
        return NextResponse.json(
          { error: "Failed to complete order" },
          { status: 500 }
        );
      }

      const orderId = completeResult.orderId!;

      // Create payment record
      await db.insert(orderPayments).values({
        orderId: orderId,
        amount: totalAmount,
        currency: draft.currency,
        provider: "stripe",
        providerPaymentId: paymentIntentId,
        platformFeeAmount: applicationFeeAmount,
        netAmountToStore: netAmountToStore,
        stripePaymentIntentId: paymentIntentId,
        stripeCheckoutSessionId: session.id,
        status: "completed",
      });

      // Create order event
      await db.insert(orderEvents).values({
        orderId: orderId,
        type: "payment",
        visibility: "internal",
        message: `Payment received via Stripe (${totalAmount} ${draft.currency})`,
        metadata: {
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: session.id,
          platformFee: applicationFeeAmount,
          netAmountToStore: netAmountToStore,
        } as Record<string, unknown>,
      });

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
```

---

### Part 7: Update UI Components

#### 7.1 Update Draft Order Details Page

Update the "Send Invoice" button handler in `DraftOrderDetailsPageClient.tsx` (same as before, but now uses token-based URLs automatically).

#### 7.2 Add Invoice Status Display

Show invoice sent status:

```typescript
{draftData.invoiceSentAt && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Mail className="h-4 w-4" />
    <span>
      Invoice sent {new Date(draftData.invoiceSentAt).toLocaleDateString()}
    </span>
    {draftData.invoiceSentCount > 1 && (
      <span>({draftData.invoiceSentCount} times)</span>
    )}
  </div>
)}
```

---

### Part 8: Effects on Related Tables

#### 8.1 When "Send Invoice" is Clicked

- Generates secure `invoiceToken`
- Sets `invoiceExpiresAt` (30 days)
- Updates `invoiceSentAt` and `invoiceSentCount`
- Sends email with token-based payment URL
- No inventory or order changes

#### 8.2 When Customer Pays via Stripe

- Webhook receives `checkout.session.completed`
- Converts draft → order (via `completeDraftOrder`)
- Creates `orderPayments` record with:
  - Gross amount
  - Platform fee (5%)
  - Net amount to store
  - Stripe IDs
- Adjusts inventory (commits, since `markAsPaid = true`)
- Creates order events
- Marks draft as `completed = true`

#### 8.3 When "Mark as Paid" is Clicked (Manual)

- Updates `draft_orders.paymentStatus` to `"paid"`
- No inventory changes (happens on order creation)
- No Stripe processing

---

### Part 9: Stripe Connect Setup Requirements

#### 9.1 Store Onboarding

Stores must connect their Stripe account:

1. Create Stripe Connect onboarding flow
2. Store `stripeAccountId` in `store` table
3. Handle OAuth callback from Stripe

#### 9.2 Platform Account Setup

- Set up Stripe Connect in your Stripe Dashboard
- Configure platform settings
- Get your platform account ID

---

### Part 10: Testing Checklist

- [ ] Send invoice generates token and sends email
- [ ] Invoice email contains correct token-based URL
- [ ] Public payment page loads with valid token
- [ ] Payment page shows error for expired/invalid tokens
- [ ] "Pay Now" creates Stripe Checkout Session
- [ ] Stripe Checkout redirects correctly
- [ ] Webhook receives `checkout.session.completed`
- [ ] Webhook converts draft to order
- [ ] Payment record created with correct fees
- [ ] Inventory committed correctly
- [ ] Order events created
- [ ] Success page displays after payment
- [ ] Manual "Mark as Paid" works without Stripe

---

### Summary

This implementation provides:

1. Token-based invoice system with secure payment links
2. Stripe Checkout with Connect (Destination Charges)
3. Automatic 5% platform fee calculation
4. Webhook-based order conversion
5. Public payment pages (no authentication required)
6. Payment tracking with fee breakdown
7. Manual payment marking option

The system follows the Destination Charges model where:

- Customer pays your platform
- Stripe automatically transfers money to the store
- You keep your 5% platform fee
- All configured at Checkout Session creation time

**Important**: Stripe Connect fee splits are defined when creating the Checkout Session — this is the only correct place. Webhooks only confirm what already happened.
