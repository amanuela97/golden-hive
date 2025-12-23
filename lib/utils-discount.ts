import {
  Discount,
  CartItem,
  DiscountTarget,
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
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

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
    if (!discountAppliesToItem(discount, item)) continue;

    const lineSubtotal = item.price * item.quantity;
    let discountAmount = 0;

    if (discount.valueType === "percentage") {
      discountAmount = roundMoney((lineSubtotal * discount.value) / 100);
    }

    if (discount.valueType === "fixed") {
      // Shopify-style: fixed amount per item
      discountAmount = Math.min(discount.value * item.quantity, lineSubtotal);
    }

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

    if (!allocation) return item;

    const discountAmount = allocation.amount;

    orderItemDiscounts.push({
      id: crypto.randomUUID(),
      orderItemId: item.id,
      orderDiscountId: discountResult.discountId,
      amount: discountAmount,
    });

    return {
      ...item,
      discountAmount: discountAmount,
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
