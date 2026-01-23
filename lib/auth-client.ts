"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { auth } from "./auth";

// Get baseURL - use env var if set, otherwise use current origin
// Better Auth will handle the /api/auth prefix automatically
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  );
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient()],
});

export const {
  signIn,
  signUp,
  resetPassword,
  signOut,
  useSession,
  requestPasswordReset,
  deleteUser,
  listAccounts,
} = authClient;
