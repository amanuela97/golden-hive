"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        phone: { type: "string" },
        isAdmin: { type: "boolean" },
      },
    }),
    magicLinkClient(),
  ],
});

export const {
  signIn,
  signUp,
  resetPassword,
  signOut,
  useSession,
  requestPasswordReset,
} = authClient;
