import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your Drizzle schema
import resend from "./resend";
import ResetPasswordEmail from "@/app/components/reset-password-email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or whatever DB you use
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 20,
    // it sends the reset password token using resend to your email
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: "Golden Hive <onboarding@resend.dev>",
        to: user.email,
        subject: "Reset your password",
        react: ResetPasswordEmail({ url }),
      });
    },
    onPasswordReset: async ({ user }) => {
      // e.g. log, clear some cache, send a notification, etc.
      console.log(`Password reset for ${user.email}`);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
