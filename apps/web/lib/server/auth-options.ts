import "server-only";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
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
  ],
  pages: {
    signIn: "/",
  },
};
