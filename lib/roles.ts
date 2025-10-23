export enum UserRole {
  SELLER = "Seller",
  ADMIN = "Admin",
  CUSTOMER = "Customer",
}

export const USER_ROLES = Object.values(UserRole);

export type UserRoleType = keyof typeof UserRole;
