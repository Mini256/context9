import "server-only";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import { context9AuthAdapter } from "./context9-auth-adapter";
import { isResendConfigured, sendMagicLinkEmail } from "./resend";

const emailAuthEnabled = isResendConfigured();
const githubAuthEnabled = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
);
const databaseAuthEnabled = emailAuthEnabled || githubAuthEnabled;

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (githubAuthEnabled) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
  );
}

if (emailAuthEnabled) {
  providers.push(
    EmailProvider({
      from: process.env.CONTEXT9_EMAIL_FROM!,
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, expires }) {
        await sendMagicLinkEmail({
          to: identifier,
          url,
          expires,
        });
      },
    }),
  );
}

providers.push(
  CredentialsProvider({
    name: "Context9 Admin",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const adminEmail = process.env.CONTEXT9_ADMIN_EMAIL;
      const adminPassword = process.env.CONTEXT9_ADMIN_PASSWORD;

      if (!adminEmail || !adminPassword) {
        return null;
      }

      if (
        credentials?.email === adminEmail &&
        credentials?.password === adminPassword
      ) {
        return {
          id: adminEmail,
          email: adminEmail,
          name: "Context9 Admin",
        };
      }

      return null;
    },
  }),
);

export const authOptions: NextAuthOptions = {
  adapter: databaseAuthEnabled ? context9AuthAdapter() : undefined,
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async signIn() {
      return true;
    },
  },
};
