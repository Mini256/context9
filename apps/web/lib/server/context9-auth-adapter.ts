import "server-only";

import { randomUUID } from "node:crypto";
import type {
  AdapterAccount,
  Adapter,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import { openContext9DbSession } from "./context9-db";

interface AuthUserRow {
  id: string;
  email: string;
  name: string | null;
  email_verified: string | null;
}

interface AuthAccountUserRow extends AuthUserRow {
  provider: string;
  provider_account_id: string;
}

interface VerificationTokenRow {
  identifier: string;
  token: string;
  expires: string;
}

function mapUser(row: AuthUserRow): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
  };
}

function mapVerificationToken(row: VerificationTokenRow): VerificationToken {
  return {
    identifier: row.identifier,
    token: row.token,
    expires: new Date(row.expires),
  };
}

async function withDb<T>(
  operation: Parameters<
    Awaited<ReturnType<typeof openContext9DbSession>>["prisma"]["$transaction"]
  >[0] extends (tx: infer _Tx) => Promise<infer _Result>
    ? (prisma: Awaited<ReturnType<typeof openContext9DbSession>>["prisma"]) => Promise<T>
    : never,
): Promise<T> {
  const session = await openContext9DbSession();

  try {
    return await operation(session.prisma);
  } finally {
    await session.close();
  }
}

export function context9AuthAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      return withDb(async (db) => {
        const rows = await db.$queryRaw<AuthUserRow[]>`
          insert into context9.auth_users (
            id,
            email,
            name,
            email_verified
          )
          values (
            ${randomUUID()}::uuid,
            ${user.email.toLowerCase()},
            ${user.name ?? null},
            ${user.emailVerified ?? null}
          )
          returning
            id::text,
            email,
            name,
            email_verified::text
        `;

        return mapUser(rows[0]);
      });
    },
    async getUser(id: string) {
      return withDb(async (db) => {
        const rows = await db.$queryRaw<AuthUserRow[]>`
          select
            id::text,
            email,
            name,
            email_verified::text
          from context9.auth_users
          where id = ${id}::uuid
          limit 1
        `;

        return rows[0] ? mapUser(rows[0]) : null;
      });
    },
    async getUserByEmail(email: string) {
      return withDb(async (db) => {
        const rows = await db.$queryRaw<AuthUserRow[]>`
          select
            id::text,
            email,
            name,
            email_verified::text
          from context9.auth_users
          where lower(email) = lower(${email})
          limit 1
        `;

        return rows[0] ? mapUser(rows[0]) : null;
      });
    },
    async getUserByAccount(
      account: Pick<AdapterAccount, "provider" | "providerAccountId">,
    ) {
      return withDb(async (db) => {
        const rows = await db.$queryRaw<AuthAccountUserRow[]>`
          select
            user_row.id::text as id,
            user_row.email,
            user_row.name,
            user_row.email_verified::text,
            account_row.provider,
            account_row.provider_account_id
          from context9.auth_accounts as account_row
          join context9.auth_users as user_row
            on user_row.id = account_row.user_id
          where
            account_row.provider = ${account.provider}
            and account_row.provider_account_id = ${account.providerAccountId}
          limit 1
        `;

        return rows[0] ? mapUser(rows[0]) : null;
      });
    },
    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
      return withDb(async (db) => {
        const rows = await db.$queryRaw<AuthUserRow[]>`
          update context9.auth_users
          set
            email = coalesce(${user.email?.toLowerCase() ?? null}, email),
            name = coalesce(${user.name ?? null}, name),
            email_verified = coalesce(${user.emailVerified ?? null}, email_verified),
            updated_at = now()
          where id = ${user.id}::uuid
          returning
            id::text,
            email,
            name,
            email_verified::text
        `;

        if (!rows[0]) {
          throw new Error(`Auth user "${user.id}" does not exist.`);
        }

        return mapUser(rows[0]);
      });
    },
    async linkAccount(account: AdapterAccount) {
      return withDb(async (db) => {
        await db.$executeRaw`
          insert into context9.auth_accounts (
            provider,
            provider_account_id,
            user_id
          )
          values (
            ${account.provider},
            ${account.providerAccountId},
            ${account.userId}::uuid
          )
          on conflict (provider, provider_account_id)
          do update set
            user_id = excluded.user_id,
            updated_at = now()
        `;

        return account;
      });
    },
    async createSession(session: AdapterSession) {
      return session;
    },
    async getSessionAndUser(_sessionToken: string) {
      return null;
    },
    async updateSession(
      _session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">,
    ) {
      return null;
    },
    async deleteSession(_sessionToken: string) {
      return null;
    },
    async createVerificationToken(token: VerificationToken) {
      return withDb(async (db) => {
        await db.$executeRaw`
          insert into context9.auth_verification_tokens (
            identifier,
            token,
            expires
          )
          values (
            ${token.identifier.toLowerCase()},
            ${token.token},
            ${token.expires}
          )
        `;

        return token;
      });
    },
    async useVerificationToken(params: {
      identifier: string;
      token: string;
    }) {
      return withDb(async (db) =>
        db.$transaction(async (tx) => {
          const identifier = params.identifier?.toLowerCase() ?? "";
          const rows = await tx.$queryRaw<VerificationTokenRow[]>`
            select
              identifier,
              token,
              expires::text
            from context9.auth_verification_tokens
            where identifier = ${identifier} and token = ${params.token}
            limit 1
          `;

          if (!rows[0]) {
            return null;
          }

          await tx.$executeRaw`
            delete from context9.auth_verification_tokens
            where identifier = ${identifier} and token = ${params.token}
          `;

          return mapVerificationToken(rows[0]);
        }),
      );
    },
  };
}
