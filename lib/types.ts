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
