export enum ListingStatus {
  active = "active",
  draft = "draft",
  archived = "archived",
}

export interface Variant {
  id: string;
  title: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
  options: string[];
  image?: string;
}

export type ActionResponse = {
  success: boolean;
  message?: string;
  error?: string;
  payload?: FormData;
  result?: unknown;
  data?: unknown;
  redirectTo?: string;
};

export const initialState: ActionResponse = {
  success: false,
  message: "",
  error: undefined,
  payload: undefined,
};

export interface GetAllUsersResponse {
  users: Array<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    status: "active" | "pending" | "suspended";
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    roleName: string | null;
    roleId: number | null;
    listingsCount: number;
    isAdmin: boolean;
  }>;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetAllRolesResponse {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: Date | null;
  updatedAt: Date;
  permissions: GetAllPermissionsResponse[];
}

export interface GetAllPermissionsResponse {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  createdAt: Date | null;
  updatedAt: Date;
  rolePermissions: GetAllRolesResponse[];
}

export interface GetRoleWithPermissionsResponse {
  id: number;
  name: string;
  description: string | null;
  userCount: number;
  permissions: GetAllPermissionsResponse[];
  createdAt: Date | null;
  updatedAt: Date;
  rolePermissions: GetAllRolesResponse[];
}

export interface GetUserStatsResponse {
  totalUsers: number;
  adminUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  recentSignups: number;
}

export interface UserUpdateData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  status?: "active" | "pending" | "suspended";
  roleId?: number;
  updatedAt: Date;
}

export interface RoleUpdateData {
  name?: string;
  description?: string;
  permissions?: string[];
  updatedAt?: Date;
}

export interface PermissionUpdateData {
  name?: string;
  description?: string;
  category?: string;
  updatedAt?: Date;
}

// Discounts

export type Money = number;

export interface CartItem {
  id: string; // Unique cart item ID (variantId || listingId)
  listingId: string; // Required for order creation
  listingSlug?: string | null; // Product slug for URL generation
  variantId?: string | null; // Optional variant ID
  variantTitle?: string | null; // Variant title (e.g., "Size: Large, Color: Red")
  name: string;
  price: Money;
  quantity: number;
  image?: string | null;
  category?: string | null;
  currency?: string;
  sku?: string | null; // Optional SKU
  storeId?: string | null; // Store/seller ID for ownership checking (per inst.md)
}

export type DiscountValueType = "fixed" | "percentage";

export type DiscountTargetType = "all_products" | "listing_ids";

export interface DiscountTarget {
  type: DiscountTargetType;
  listingIds?: string[];
}

export type CustomerEligibilityType = "all" | "specific";

export interface Discount {
  id: string;
  type: "amount_off_products";

  valueType: DiscountValueType;
  value: Money;
  currency?: string;

  targets: DiscountTarget[];

  // Minimum requirements
  minPurchaseAmount?: Money | null;
  minPurchaseQuantity?: number | null;

  // Eligibility
  customerEligibilityType: CustomerEligibilityType;
  eligibleCustomerIds?: string[];

  // Status
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;

  // Ownership (per inst.md)
  ownerType: "admin" | "seller";
  ownerId?: string | null; // sellerId when ownerType = "seller", null for admin
}

export interface OrderItemDiscountAllocation {
  cartItemId: string;
  discountId: string;
  amount: Money;
}

export interface OrderDiscountResult {
  discountId: string;
  totalAmount: Money;
  allocations: OrderItemDiscountAllocation[];
}

export interface Order {
  id: string;
  customerId?: string | null;
  currency: string;

  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  total: Money;

  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;

  listingId: string;
  variantId?: string | null;
  name: string;

  unitPrice: Money;
  quantity: number;

  subtotal: Money;
  discountAmount: Money;
  taxAmount: Money;
  lineTotal: Money;
}

export interface OrderDiscount {
  id: string;
  orderId: string;

  discountId: string;
  valueType: "fixed" | "percentage";
  value: Money;

  amount: Money;
  currency: string;
}

export interface OrderItemDiscount {
  id: string;
  orderItemId: string;
  orderDiscountId: string;
  amount: Money;
}
