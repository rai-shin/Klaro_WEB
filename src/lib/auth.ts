
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,

    // Invalidate existing sessions after a successful reset.
    revokeSessionsOnPasswordReset: true,

    // Password reset email delivery.
    sendResetPassword: async ({ user, url }) => {
      const { error } = await resend.emails.send({
        from: "Klaro <onboarding@resend.dev>",
        to: user.email,
        subject: "Reset Your Klaro Password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
            <h2 style="color: #2563eb;">Klaro Password Reset</h2>

            <p>Hello ${user.name || "Klaro user"},</p>

            <p>
              We received a request to reset your Klaro account password.
              Click the button below to choose a new password.
            </p>

            <p style="margin: 28px 0;">
              <a
                href="${url}"
                style="background: #2563eb; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; display: inline-block;"
              >
                Reset Password
              </a>
            </p>

            <p>
              If you did not request a password reset, you can safely
              ignore this email.
            </p>

            <p style="color: #64748b; font-size: 12px;">
              This password reset link expires after one hour.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("Klaro password reset email failed:", error);
        throw new Error("Unable to send password reset email.");
      }
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,
      },

      isActive: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
});
