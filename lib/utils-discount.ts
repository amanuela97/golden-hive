import {
  Discount,
  CartItem,
  OrderDiscountResult,
  OrderItemDiscountAllocation,
  OrderItem,
  OrderDiscount,
  OrderItemDiscount,
  Order,
} from "./types";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isDiscountActive(
  discount: Discount,
  now = new Date()
): boolean {
  if (!discount.isActive) return false;
  if (discount.startsAt && now < discount.startsAt) return false;
  if (discount.endsAt && now > discount.endsAt) return false;
  return true;
}

export function meetsMinimumRequirements(
  discount: Discount,
  items: CartItem[]
): boolean {
  // Only check requirements against items that the discount applies to
  const applicableItems = items.filter((item) =>
    discountAppliesToItem(discount, item)
  );

  // If discount doesn't apply to any items, requirements can't be met
  if (applicableItems.length === 0) return false;

  const subtotal = applicableItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalQuantity = applicableItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  if (
    discount.minPurchaseAmount != null &&
    subtotal < discount.minPurchaseAmount
  ) {
    return false;
  }

  if (
    discount.minPurchaseQuantity != null &&
    totalQuantity < discount.minPurchaseQuantity
  ) {
    return false;
  }

  return true;
}

export function isCustomerEligible(
  discount: Discount,
  customerId?: string | null
): boolean {
  if (discount.customerEligibilityType === "all") return true;
  if (!customerId) return false;

  return discount.eligibleCustomerIds?.includes(customerId) ?? false;
}

export function discountAppliesToItem(
  discount: Discount,
  item: CartItem
): boolean {
  // Enforce ownership boundary (per inst.md)
  if (discount.ownerType === "seller") {
    // Seller discounts only apply to their own products
    if (item.storeId !== discount.ownerId) return false;
  }
  // Admin discounts apply to all products (no ownership check needed)

  // Then apply target logic
  return discount.targets.some((target) => {
    if (target.type === "all_products") return true;

    if (target.type === "listing_ids") {
      return target.listingIds?.includes(item.listingId) ?? false;
    }

    return false;
  });
}

/**
 * Calculate discount amount for a single item with a single discount
 */
function calculateItemDiscountAmount(
  item: CartItem,
  discount: Discount
): number {
  if (!discountAppliesToItem(discount, item)) return 0;

  const lineSubtotal = item.price * item.quantity;
  let discountAmount = 0;

  if (discount.valueType === "percentage") {
    discountAmount = roundMoney((lineSubtotal * discount.value) / 100);
  }

  if (discount.valueType === "fixed") {
    // Shopify-style: fixed amount per item
    discountAmount = Math.min(discount.value * item.quantity, lineSubtotal);
  }

  return discountAmount > 0 ? discountAmount : 0;
}

/**
 * Evaluate a single discount against cart items.
 *
 * IMPORTANT: This function evaluates ONE discount only.
 * - Each product item can only receive ONE discount (no stacking)
 * - If multiple discounts are eligible, use evaluateBestDiscountsPerItem() instead
 * - This function does NOT prevent stacking if called multiple times - the caller must ensure
 *   only one discount is evaluated/applied at a time
 *
 * @param items - Cart items to evaluate discount for
 * @param discount - Single discount to evaluate
 * @param customerId - Optional customer ID for eligibility checking
 * @returns Discount result with allocations per item, or null if discount doesn't apply
 */
export function evaluateAmountOffProductsDiscount(
  items: CartItem[],
  discount: Discount,
  customerId?: string | null
): OrderDiscountResult | null {
  if (!isDiscountActive(discount)) return null;

  if (!isCustomerEligible(discount, customerId)) return null;

  if (!meetsMinimumRequirements(discount, items)) return null;

  const allocations: OrderItemDiscountAllocation[] = [];
  let totalDiscountAmount = 0;

  for (const item of items) {
    const discountAmount = calculateItemDiscountAmount(item, discount);
    if (discountAmount <= 0) continue;

    allocations.push({
      cartItemId: item.id,
      discountId: discount.id,
      amount: discountAmount,
    });

    totalDiscountAmount += discountAmount;
  }

  if (allocations.length === 0) return null;

  return {
    discountId: discount.id,
    totalAmount: roundMoney(totalDiscountAmount),
    allocations,
  };
}

/**
 * Evaluate multiple discounts and apply only the best discount per product item.
 * This ensures discounts don't stack or compound unintentionally.
 *
 * For each cart item, finds all eligible discounts and applies only the one
 * that gives the highest discount amount for that specific item.
 *
 * @param items - Cart items to evaluate discounts for
 * @param discounts - Array of eligible discounts to evaluate
 * @param customerId - Optional customer ID for eligibility checking
 * @returns Combined discount result with best discount per item, or null if no discounts apply
 */
export function evaluateBestDiscountsPerItem(
  items: CartItem[],
  discounts: Discount[],
  customerId?: string | null
): OrderDiscountResult | null {
  if (discounts.length === 0 || items.length === 0) return null;

  // Filter to only active, eligible discounts that meet minimum requirements
  const eligibleDiscounts = discounts.filter((discount) => {
    if (!isDiscountActive(discount)) return false;
    if (!isCustomerEligible(discount, customerId)) return false;
    if (!meetsMinimumRequirements(discount, items)) return false;
    return true;
  });

  if (eligibleDiscounts.length === 0) return null;

  // For each item, find the best discount (highest discount amount)
  // This ensures only one discount is applied per item, preventing stacking
  const allocations: OrderItemDiscountAllocation[] = [];
  let totalDiscountAmount = 0;
  let primaryDiscountId = ""; // The discount ID that gives the highest total savings

  // Track total savings per discount to determine primary discount
  const discountTotals = new Map<string, number>();

  for (const item of items) {
    let bestDiscount: Discount | null = null;
    let bestAmount = 0;

    // Evaluate all eligible discounts for this item and pick the best one
    for (const discount of eligibleDiscounts) {
      const discountAmount = calculateItemDiscountAmount(item, discount);
      if (discountAmount > bestAmount) {
        bestAmount = discountAmount;
        bestDiscount = discount;
      }
    }

    // Apply only the best discount for this item (no stacking)
    if (bestDiscount && bestAmount > 0) {
      allocations.push({
        cartItemId: item.id,
        discountId: bestDiscount.id,
        amount: bestAmount,
      });

      totalDiscountAmount += bestAmount;

      // Track totals per discount
      const currentTotal = discountTotals.get(bestDiscount.id) || 0;
      discountTotals.set(bestDiscount.id, currentTotal + bestAmount);
    }
  }

  if (allocations.length === 0) return null;

  // Determine primary discount (the one with highest total savings)
  // This is used as the main discountId in the result
  for (const [discountId, total] of discountTotals.entries()) {
    if (
      !primaryDiscountId ||
      total > (discountTotals.get(primaryDiscountId) || 0)
    ) {
      primaryDiscountId = discountId;
    }
  }

  return {
    discountId: primaryDiscountId,
    totalAmount: roundMoney(totalDiscountAmount),
    allocations, // Each allocation has its own discountId (best for that item)
  };
}

function createOrderItemsFromCart(
  orderId: string,
  cartItems: CartItem[]
): OrderItem[] {
  return cartItems.map((item) => {
    const subtotal = item.price * item.quantity;

    return {
      id: crypto.randomUUID(),
      orderId,

      listingId: item.listingId,
      variantId: item.variantId ?? null,
      name: item.name,

      unitPrice: item.price,
      quantity: item.quantity,

      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      lineTotal: subtotal,
    };
  });
}

/**
 * Apply discount to order items.
 * IMPORTANT: This function replaces any existing discount on items.
 * It does NOT stack discounts - only one discount per item is allowed.
 */
function applyDiscountToOrderItems(
  orderItems: OrderItem[],
  discountResult: OrderDiscountResult
): {
  updatedItems: OrderItem[];
  orderItemDiscounts: OrderItemDiscount[];
} {
  const orderItemDiscounts: OrderItemDiscount[] = [];

  const updatedItems = orderItems.map((item) => {
    const allocation = discountResult.allocations.find(
      (a) => a.cartItemId === item.id
    );

    if (!allocation) {
      // No discount for this item - keep existing discountAmount (if any)
      // This allows items without discounts to remain unchanged
      return item;
    }

    // Apply the discount amount (replaces any existing discount)
    // This ensures only one discount is applied per item (no stacking)
    const discountAmount = allocation.amount;

    orderItemDiscounts.push({
      id: crypto.randomUUID(),
      orderItemId: item.id,
      orderDiscountId: allocation.discountId, // Use the discountId from allocation
      amount: discountAmount,
    });

    return {
      ...item,
      discountAmount: discountAmount, // Replace, don't add
      lineTotal: item.subtotal - discountAmount,
    };
  });

  return { updatedItems, orderItemDiscounts };
}

function createOrderDiscount(
  orderId: string,
  discount: Discount,
  discountResult: OrderDiscountResult,
  currency: string
): OrderDiscount {
  return {
    id: crypto.randomUUID(),
    orderId,

    discountId: discount.id,
    valueType: discount.valueType,
    value: discount.value,

    amount: discountResult.totalAmount,
    currency,
  };
}

function calculateOrderTotals(items: OrderItem[]) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const discountTotal = items.reduce((s, i) => s + i.discountAmount, 0);
  const taxTotal = items.reduce((s, i) => s + i.taxAmount, 0);

  const total = subtotal - discountTotal + taxTotal;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    total,
  };
}

/**
 * Create order from cart with discount application.
 *
 * IMPORTANT: Only one discount is applied per product item.
 * If multiple discounts are eligible, only the best one (highest discount amount)
 * should be selected before calling this function.
 *
 * This function does NOT evaluate multiple discounts - it applies the provided discount.
 * To evaluate multiple discounts and pick the best, use evaluateBestDiscountsPerItem first.
 */
export function createOrderFromCart(params: {
  cartItems: CartItem[];
  discount?: Discount | null;
  customerId?: string | null;
  currency: string;
}) {
  const orderId = crypto.randomUUID();

  // 1️⃣ Create base order items
  let orderItems = createOrderItemsFromCart(orderId, params.cartItems);

  let orderDiscount: OrderDiscount | null = null;
  let orderItemDiscounts: OrderItemDiscount[] = [];

  // 2️⃣ Apply discount (if present)
  // NOTE: Only one discount is applied. If multiple discounts are eligible,
  // the caller should evaluate all and pass only the best discount.
  if (params.discount) {
    const discountResult = evaluateAmountOffProductsDiscount(
      params.cartItems,
      params.discount,
      params.customerId
    );

    if (discountResult) {
      const applied = applyDiscountToOrderItems(orderItems, discountResult);

      orderItems = applied.updatedItems;
      orderItemDiscounts = applied.orderItemDiscounts;

      orderDiscount = createOrderDiscount(
        orderId,
        params.discount,
        discountResult,
        params.currency
      );
    }
  }

  // 3️⃣ Calculate totals
  const totals = calculateOrderTotals(orderItems);

  // 4️⃣ Create order
  const order: Order = {
    id: orderId,
    customerId: params.customerId ?? null,
    currency: params.currency,

    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,

    createdAt: new Date(),
  };

  return {
    order,
    orderItems,
    orderDiscount,
    orderItemDiscounts,
  };
}
