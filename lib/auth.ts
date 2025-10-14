import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your Drizzle schema
import resend from "./resend";
import ResetPasswordEmail from "@/app/components/reset-password-email";
import { nextCookies } from "better-auth/next-js";
import { User } from "better-auth";
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or whatever DB you use
  }),
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      city: { type: "string", required: false },
      address: { type: "string", required: false },
      country: { type: "string", required: false },
      status: { type: "string", required: false },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await resend.emails.send({
          from: "Golden Hive <goldenhive@resend.dev>",
          to: user.email,
          subject: "Verify Account Deletion",
          html: `Click the link to verify your account deletion: ${url}`,
        });
      },
    },
    beforeDelete: async ({ user }: { user: User }) => {
      if (process.env.ADMIN_LIST?.split(",").includes(user.email)) {
        throw new APIError("BAD_REQUEST", {
          message: "Admin accounts can't be deleted",
        });
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 20,
    requireEmailVerification: true, //It does not allow user to login without email verification
    // it sends the reset password token using resend to your email
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
      await resend.emails.send({
        from: "Golden Hive <goldenhive@resend.dev>",
        to: user.email,
        subject: "Reset your password",
        react: ResetPasswordEmail({ url: resetUrl }),
      });
    },
    onPasswordReset: async ({ user }) => {
      // e.g. log, clear some cache, send a notification, etc.
      console.log(`Password reset for ${user.email}`);
    },
  },
  emailVerification: {
    sendOnSignUp: true, // Automatically sends a verification email at signup
    autoSignInAfterVerification: true, // Automatically signIn the user after verification
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: "Golden Hive <goldenhive@resend.dev>", // You could add your custom domain
        to: user.email, // email of the user to want to end
        subject: "Email Verification", // Main subject of the email
        html: `Click the link to verify your email: ${url}`, // Content of the email
        // you could also use "React:" option for sending the email template and there content to user
      });
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies()],
});

export const {
  signInEmail,
  signUpEmail,
  resetPassword,
  signOut,
  requestPasswordReset,
  listUserAccounts,
} = auth.api;
