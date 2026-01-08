Creating a testing flow guide for cancellation and refund logic. Reviewing the implementation to ensure accuracy:

[4 tools called]

Testing flow guide for cancellation and refund logic:

## Testing flow guide: cancellation and refund logic

### Prerequisites

1. Test accounts:
   - Customer account (logged in)
   - Seller account (has a store)
   - Admin account (optional)

2. Stripe test mode:
   - Use Stripe test cards
   - Monitor Stripe Dashboard → Payments

3. Database access:
   - Access to verify order statuses, refund records, etc.

---

## Test flow 1: Customer cancellation (before capture — void payment)

Goal: Cancel before seller captures payment → void payment (no Stripe fees).

### Steps

1. Create an order as a customer:
   - Add items to cart
   - Complete checkout
   - Note the order number

2. Verify initial state:
   - Go to `/dashboard/orders` (customer view)
   - Find the order
   - Expected:
     - Status: `open`
     - Payment Status: `pending`
     - Fulfillment Status: `unfulfilled`
     - "Cancel Order" button visible

3. Cancel the order:
   - Click "Cancel Order"
   - Select reason (e.g., "Changed my mind")
   - Confirm cancellation

4. Verify cancellation:
   - Order status: `canceled`
   - Payment status: `void`
   - Fulfillment status: `canceled`
   - "Cancel Order" button hidden

5. Stripe verification:
   - Stripe Dashboard → Payments
   - Find the Payment Intent
   - Status: `canceled`
   - No refund created (voided, not refunded)

6. Database verification:

   ```sql
   -- Check order
   SELECT status, payment_status, fulfillment_status,
          cancellation_reason, cancellation_requested_at
   FROM orders
   WHERE order_number = '<ORDER_NUMBER>';

   -- Check payment
   SELECT status, refunded_amount
   FROM order_payments
   WHERE order_id = '<ORDER_ID>';

   -- Should be NO refund record
   SELECT * FROM order_refunds WHERE order_id = '<ORDER_ID>';
   ```

Expected result: Payment voided, no Stripe fees, order canceled.

---

## Test flow 2: Customer cancellation (after capture — refund)

Goal: Cancel after seller captures payment → full refund (Stripe fee applies, platform absorbs).

### Steps

1. Create an order as a customer:
   - Complete checkout
   - Note the order number

2. Capture payment as seller:
   - Log in as seller
   - Go to `/dashboard/orders`
   - Find the order
   - Mark as "Processing" or "Accepted" (triggers `captureOrderPayment`)
   - Or manually call the capture function

3. Verify payment captured:
   - Order payment status: `paid`
   - Stripe Dashboard: Payment Intent status: `succeeded`

4. Cancel as customer:
   - Log in as customer
   - Go to `/dashboard/orders`
   - Find the order
   - Click "Cancel Order"
   - Select reason and confirm

5. Verify refund:
   - Order status: `canceled`
   - Payment status: `refunded`
   - Fulfillment status: `canceled`

6. Stripe verification:
   - Stripe Dashboard → Payments
   - Find the Payment Intent
   - Status: `succeeded`
   - Refunds section: Full refund created
   - Note: Stripe fee not returned (platform absorbs)

7. Database verification:

   ```sql
   -- Check refund record
   SELECT amount, status, fee_paid_by, refund_method, reason
   FROM order_refunds
   WHERE order_id = '<ORDER_ID>';

   -- Should show:
   -- fee_paid_by: 'platform'
   -- refund_method: 'refund'
   ```

Expected result: Full refund issued, Stripe fee absorbed by platform, order canceled.

---

## Test flow 3: Customer refund request (after fulfillment)

Goal: Request refund after order is fulfilled/shipped.

### Steps

1. Create and fulfill an order:
   - Customer places order
   - Seller captures payment
   - Seller marks order as "Fulfilled" or "Shipped"

2. Verify order state:
   - Status: `open`
   - Payment Status: `paid`
   - Fulfillment Status: `fulfilled` or `partial`
   - "Request Refund" button visible

3. Request refund:
   - Customer clicks "Request Refund"
   - Fill form:
     - Reason: e.g., "Damaged item", "Changed mind"
     - Description (optional)
     - Evidence images (optional)
   - Submit

4. Verify request created:
   - Order `refundRequestStatus`: `pending`
   - "Request Refund" button hidden
   - Success message shown

5. Database verification:

   ```sql
   -- Check refund request
   SELECT reason, description, status, evidence_images
   FROM refund_requests
   WHERE order_id = '<ORDER_ID>';

   -- Check order
   SELECT refund_request_status, refund_requested_at, refund_request_reason
   FROM orders
   WHERE id = '<ORDER_ID>';
   ```

Expected result: Refund request created with status `pending`, order updated.

---

## Test flow 4: Seller review and approve refund

Goal: Seller approves refund request → processes refund.

### Steps

1. View refund requests:
   - Log in as seller
   - Go to `/dashboard/orders/refund-requests`
   - Find the pending request

2. Review request:
   - Click "Review"
   - Verify customer info, reason, amount

3. Approve refund:
   - Action: "Approve Refund"
   - Fee Paid By: "Seller" or "Platform"
   - Click "Approve & Process Refund"

4. Verify processing:
   - Success message
   - Request status: `approved`
   - Order `refundRequestStatus`: `approved`

5. Stripe verification:
   - Stripe Dashboard → Payments
   - Refund created
   - Amount matches order total (minus any previous refunds)

6. Database verification:

   ```sql
   -- Check refund request
   SELECT status, reviewed_by, reviewed_at
   FROM refund_requests
   WHERE id = '<REFUND_REQUEST_ID>';

   -- Check refund record
   SELECT amount, fee_paid_by, stripe_fee_amount, status
   FROM order_refunds
   WHERE order_id = '<ORDER_ID>';

   -- Check order
   SELECT refund_request_status, refunded_amount, payment_status
   FROM orders
   WHERE id = '<ORDER_ID>';
   ```

Expected result: Refund processed, fee ownership recorded, order updated.

---

## Test flow 5: Seller review and reject refund

Goal: Seller rejects refund request with reason.

### Steps

1. View refund requests:
   - Seller goes to `/dashboard/orders/refund-requests`
   - Find pending request

2. Reject request:
   - Click "Review"
   - Action: "Reject Request"
   - Rejection reason: e.g., "Item was used" or "Outside return window"
   - Click "Reject Request"

3. Verify rejection:
   - Success message
   - Request status: `rejected`
   - Order `refundRequestStatus`: `rejected`

4. Customer view:
   - Customer sees order
   - "Request Refund" button hidden (already requested)
   - Rejection reason visible (if implemented)

5. Database verification:

   ```sql
   -- Check refund request
   SELECT status, rejection_reason, reviewed_by, reviewed_at
   FROM refund_requests
   WHERE id = '<REFUND_REQUEST_ID>';

   -- Should be NO refund record
   SELECT * FROM order_refunds WHERE order_id = '<ORDER_ID>';
   ```

Expected result: Request rejected, no refund processed, reason recorded.

---

## Edge cases and validation tests

### Test 6: Cancel already canceled order

Steps:

1. Try to cancel an order that is already `canceled`
2. Expected: Error message "Order is already canceled"

### Test 7: Cancel fulfilled order

Steps:

1. Try to cancel an order with `fulfillmentStatus: "fulfilled"`
2. Expected: Error "Order cannot be cancelled. It has already been fulfilled or shipped."
3. Should suggest using "Request Refund" instead

### Test 8: Request refund for unfulfilled order

Steps:

1. Try to request refund for order with `fulfillmentStatus: "unfulfilled"`
2. Expected: Error "Order not yet fulfilled. Please cancel the order instead."

### Test 9: Request refund for unpaid order

Steps:

1. Try to request refund for order with `paymentStatus: "pending"`
2. Expected: Error "Order payment not completed. Cannot request refund."

### Test 10: Duplicate refund request

Steps:

1. Request refund (status becomes `pending`)
2. Try to request refund again
3. Expected: Error "Refund request already pending"

### Test 11: Customer cancels another customer's order

Steps:

1. Customer A creates order
2. Customer B tries to cancel Customer A's order
3. Expected: Error "Unauthorized"

### Test 12: Seller processes refund for another seller's order

Steps:

1. Seller A has an order
2. Seller B tries to approve refund for Seller A's order
3. Expected: Error "Unauthorized" (unless admin)

---

## Database verification checklist

After each test, verify:

```sql
-- 1. Order status
SELECT
  id, order_number, status, payment_status, fulfillment_status,
  cancellation_reason, cancellation_requested_at,
  refund_request_status, refund_requested_at, refunded_amount
FROM orders
WHERE order_number = '<ORDER_NUMBER>';

-- 2. Payment records
SELECT
  id, status, amount, refunded_amount, stripe_payment_intent_id
FROM order_payments
WHERE order_id = '<ORDER_ID>';

-- 3. Refund records (if any)
SELECT
  id, amount, status, fee_paid_by, stripe_fee_amount,
  refund_method, reason, stripe_refund_id
FROM order_refunds
WHERE order_id = '<ORDER_ID>';

-- 4. Refund requests (if any)
SELECT
  id, reason, description, status, reviewed_by, reviewed_at,
  rejection_reason, evidence_images
FROM refund_requests
WHERE order_id = '<ORDER_ID>';
```

---

## Stripe dashboard verification

For each test involving payments:

1. Stripe Dashboard → Payments:
   - Payment Intent status
   - Refunds section (if applicable)
   - Amounts match

2. Stripe Dashboard → Events:
   - `payment_intent.canceled` (for void)
   - `charge.refunded` (for refunds)
   - Metadata includes `orderId`

3. Fee verification:
   - Void: No fee charged
   - Refund: Original fee not returned (check transaction details)

---

## Success criteria summary

| Test                  | Expected Outcome                                  |
| --------------------- | ------------------------------------------------- |
| Cancel before capture | Payment voided, no fees, order canceled           |
| Cancel after capture  | Full refund, platform absorbs fee, order canceled |
| Request refund        | Refund request created, status `pending`          |
| Approve refund        | Refund processed, fee ownership recorded          |
| Reject refund         | Request rejected, no refund, reason saved         |
| Validation errors     | Appropriate error messages shown                  |
| Authorization         | Unauthorized users blocked                        |

---

## Quick test script

Run this sequence for a full flow:

1. Customer places order → Order created, payment `pending`
2. Customer cancels → Payment voided, no fees
3. Customer places new order → Order created
4. Seller captures payment → Payment `paid`
5. Seller fulfills order → Fulfillment `fulfilled`
6. Customer requests refund → Request `pending`
7. Seller approves refund → Refund processed, fee recorded

This covers the main cancellation and refund paths.

---

## Troubleshooting

- Payment not voiding: Check Payment Intent status is `requires_capture`
- Refund not processing: Verify Payment Intent status is `succeeded`
- Authorization errors: Check user role and order ownership
- Database inconsistencies: Verify transactions are atomic

Use this guide to test the cancellation and refund logic end-to-end.
