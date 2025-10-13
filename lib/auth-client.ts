"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
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
