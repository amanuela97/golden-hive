import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your Drizzle schema
import resend from "./resend";
import ResetPasswordEmail from "@/app/[locale]/components/reset-password-email";
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
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Golden Market <goldenmarket@resend.dev>",
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

      // Delete seller documents when account is removed
      try {
        const { deleteSellerDocumentsOnAccountRemoval } = await import(
          "@/app/[locale]/actions/documentation"
        );
        await deleteSellerDocumentsOnAccountRemoval(user.id);
        console.log(`Deleted documents for user: ${user.email}`);
      } catch (error) {
        console.error("Error deleting seller documents:", error);
        // Don't throw error to prevent account deletion failure
      }

      // Delete profile image from Cloudinary
      try {
        if (user.image) {
          const { deleteFileByPublicId, extractPublicId } = await import(
            "@/lib/cloudinary"
          );
          const publicId = extractPublicId(user.image);
          if (publicId) {
            await deleteFileByPublicId(publicId);
            console.log(`Deleted profile image for user: ${user.email}`);
          }
        }
      } catch (error) {
        console.error("Error deleting profile image:", error);
        // Don't throw error to prevent account deletion failure
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
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Golden Market <goldenmarket@resend.dev>",
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
      console.log(
        `[Auth] Sending verification email to ${user.email} with URL: ${url}`
      );
      try {
        const emailResult = await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Golden Market <goldenmarket@resend.dev>",
          to: user.email, // email of the user to want to end
          subject: "Email Verification - Golden Market", // Main subject of the email
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Verify Your Email Address</h2>
              <p>Hello ${user.name || "User"},</p>
              <p>Please click the link below to verify your email address:</p>
              <p style="margin: 20px 0;">
                <a href="${url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Verify Email Address
                </a>
              </p>
              <p>Or copy and paste this URL into your browser:</p>
              <p style="word-break: break-all; color: #666;">${url}</p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </p>
            </div>
          `,
        });

        if (emailResult.error) {
          console.error(
            `[Auth] Failed to send verification email to ${user.email}:`,
            emailResult.error
          );
          throw emailResult.error;
        }

        console.log(
          `[Auth] Verification email sent successfully to ${user.email}`
        );
      } catch (error) {
        console.error(
          `[Auth] Error sending verification email to ${user.email}:`,
          error
        );
        // Re-throw to let better-auth handle it
        throw error;
      }
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
