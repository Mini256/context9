import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { openContext9DbSession } from "./context9-db";

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
const DEVICE_POLL_INTERVAL_SECONDS = 2;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface DeviceAuthRow {
  device_code: string;
  user_code: string;
  status: string;
  expires_at: string;
  access_token: string | null;
  approved_at: string | null;
  consumed_at: string | null;
  user_email: string | null;
  user_name: string | null;
}

interface AuthUserRow {
  id: string;
  email: string;
  name: string | null;
}

interface ApiTokenRow {
  user_id: string;
  email: string;
  name: string | null;
}

export interface DeviceAuthorizationStart {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  intervalSeconds: number;
}

export type DeviceAuthorizationPoll =
  | {
      status: "pending";
      intervalSeconds: number;
      expiresAt: string;
      userCode: string;
    }
  | {
      status: "approved";
      accessToken: string;
      email: string;
      name?: string;
    }
  | {
      status: "expired" | "not_found";
    };

export interface DeviceAuthorizationView {
  userCode: string;
  status: "pending" | "approved" | "expired" | "consumed" | "not_found";
  expiresAt?: string;
  approvedAt?: string;
  email?: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(): string {
  return `c9u_${randomBytes(24).toString("hex")}`;
}

function createDeviceCode(): string {
  return randomBytes(32).toString("hex");
}

function createUserCode(): string {
  const chars = Array.from({ length: 8 }, () => {
    const index = Math.floor(Math.random() * USER_CODE_ALPHABET.length);
    return USER_CODE_ALPHABET[index];
  });

  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function mapDeviceView(row?: DeviceAuthRow): DeviceAuthorizationView {
  if (!row) {
    return {
      userCode: "",
      status: "not_found",
    };
  }

  const expiresAt = new Date(row.expires_at);
  const now = Date.now();
  const base = {
    userCode: row.user_code,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at ?? undefined,
    email: row.user_email ?? undefined,
  };

  if (expiresAt.valueOf() < now && row.status === "pending") {
    return {
      ...base,
      status: "expired",
    };
  }

  if (row.status === "consumed") {
    return {
      ...base,
      status: "consumed",
    };
  }

  if (row.status === "approved") {
    return {
      ...base,
      status: "approved",
    };
  }

  return {
    ...base,
    status: "pending",
  };
}

async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  const session = await openContext9DbSession();

  try {
    const rows = await session.prisma.$queryRaw<AuthUserRow[]>`
      select
        id::text,
        email,
        name
      from context9.auth_users
      where lower(email) = lower(${email})
      limit 1
    `;

    return rows[0] ?? null;
  } finally {
    await session.close();
  }
}

async function getDeviceRowByUserCode(userCode: string): Promise<DeviceAuthRow | null> {
  const normalizedUserCode = userCode.trim().toUpperCase();
  const session = await openContext9DbSession();

  try {
    const rows = await session.prisma.$queryRaw<DeviceAuthRow[]>`
      select
        device.device_code,
        device.user_code,
        device.status,
        device.expires_at::text,
        device.access_token,
        device.approved_at::text,
        device.consumed_at::text,
        user_row.email as user_email,
        user_row.name as user_name
      from context9.auth_device_codes as device
      left join context9.auth_users as user_row
        on user_row.id = device.user_id
      where device.user_code = ${normalizedUserCode}
      limit 1
    `;

    return rows[0] ?? null;
  } finally {
    await session.close();
  }
}

export async function createDeviceAuthorization(input: {
  apiBaseUrl: string;
  machineId?: string;
  hostname?: string;
  clientName?: string;
}): Promise<DeviceAuthorizationStart> {
  const session = await openContext9DbSession();

  try {
    const deviceCode = createDeviceCode();
    const userCode = createUserCode();
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);
    const normalizedBaseUrl = input.apiBaseUrl.replace(/\/+$/, "");
    const origin = new URL(normalizedBaseUrl).origin;
    const verificationUrl = `${origin}/login/device?code=${encodeURIComponent(userCode)}`;

    await session.prisma.$executeRaw`
      insert into context9.auth_device_codes (
        device_code,
        user_code,
        status,
        expires_at,
        machine_id,
        hostname,
        client_name
      )
      values (
        ${deviceCode},
        ${userCode},
        'pending',
        ${expiresAt},
        ${input.machineId ?? null},
        ${input.hostname ?? null},
        ${input.clientName ?? null}
      )
    `;

    return {
      deviceCode,
      userCode,
      verificationUrl,
      expiresAt: expiresAt.toISOString(),
      intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
    };
  } finally {
    await session.close();
  }
}

export async function pollDeviceAuthorization(
  deviceCode: string,
): Promise<DeviceAuthorizationPoll> {
  const session = await openContext9DbSession();

  try {
    return session.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<DeviceAuthRow[]>`
        select
          device.device_code,
          device.user_code,
          device.status,
          device.expires_at::text,
          device.access_token,
          device.approved_at::text,
          device.consumed_at::text,
          user_row.email as user_email,
          user_row.name as user_name
        from context9.auth_device_codes as device
        left join context9.auth_users as user_row
          on user_row.id = device.user_id
        where device.device_code = ${deviceCode}
        limit 1
      `;

      const row = rows[0];
      if (!row) {
        return { status: "not_found" } satisfies DeviceAuthorizationPoll;
      }

      await tx.$executeRaw`
        update context9.auth_device_codes
        set last_polled_at = now()
        where device_code = ${deviceCode}
      `;

      if (
        new Date(row.expires_at).valueOf() < Date.now() &&
        row.status === "pending"
      ) {
        await tx.$executeRaw`
          update context9.auth_device_codes
          set status = 'expired'
          where device_code = ${deviceCode}
        `;

        return { status: "expired" } satisfies DeviceAuthorizationPoll;
      }

      if (row.status === "expired" || row.status === "consumed") {
        return { status: "expired" } satisfies DeviceAuthorizationPoll;
      }

      if (row.status !== "approved" || !row.access_token || !row.user_email) {
        return {
          status: "pending",
          intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
          expiresAt: row.expires_at,
          userCode: row.user_code,
        } satisfies DeviceAuthorizationPoll;
      }

      await tx.$executeRaw`
        update context9.auth_device_codes
        set
          status = 'consumed',
          consumed_at = now(),
          access_token = null
        where device_code = ${deviceCode}
      `;

      return {
        status: "approved",
        accessToken: row.access_token,
        email: row.user_email,
        name: row.user_name ?? undefined,
      } satisfies DeviceAuthorizationPoll;
    });
  } finally {
    await session.close();
  }
}

export async function getDeviceAuthorizationView(
  userCode: string,
): Promise<DeviceAuthorizationView> {
  const row = await getDeviceRowByUserCode(userCode);

  if (!row) {
    return {
      userCode: userCode.trim().toUpperCase(),
      status: "not_found",
    };
  }

  return mapDeviceView(row);
}

export async function approveDeviceAuthorization(input: {
  userCode: string;
  email: string;
}): Promise<DeviceAuthorizationView> {
  const normalizedUserCode = input.userCode.trim().toUpperCase();
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new Error("Signed-in user does not exist.");
  }

  const session = await openContext9DbSession();

  try {
    return session.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<DeviceAuthRow[]>`
        select
          device.device_code,
          device.user_code,
          device.status,
          device.expires_at::text,
          device.access_token,
          device.approved_at::text,
          device.consumed_at::text,
          user_row.email as user_email,
          user_row.name as user_name
        from context9.auth_device_codes as device
        left join context9.auth_users as user_row
          on user_row.id = device.user_id
        where device.user_code = ${normalizedUserCode}
        limit 1
      `;

      const row = rows[0];
      if (!row) {
        throw new Error("Device code not found.");
      }

      if (row.status === "consumed") {
        return mapDeviceView(row);
      }

      if (new Date(row.expires_at).valueOf() < Date.now()) {
        await tx.$executeRaw`
          update context9.auth_device_codes
          set status = 'expired'
          where user_code = ${normalizedUserCode}
        `;

        return {
          userCode: normalizedUserCode,
          status: "expired",
          expiresAt: row.expires_at,
        } satisfies DeviceAuthorizationView;
      }

      if (row.status === "approved") {
        return mapDeviceView({
          ...row,
          user_email: user.email,
          user_name: user.name,
        });
      }

      const accessToken = createAccessToken();
      const tokenId = randomUUID();

      await tx.$executeRaw`
        insert into context9.auth_api_tokens (
          id,
          user_id,
          token_hash,
          token_prefix
        )
        values (
          ${tokenId}::uuid,
          ${user.id}::uuid,
          ${hashToken(accessToken)},
          ${accessToken.slice(0, 10)}
        )
      `;

      await tx.$executeRaw`
        update context9.auth_device_codes
        set
          status = 'approved',
          user_id = ${user.id}::uuid,
          api_token_id = ${tokenId}::uuid,
          access_token = ${accessToken},
          approved_at = now()
        where user_code = ${normalizedUserCode}
      `;

      return {
        userCode: normalizedUserCode,
        status: "approved",
        expiresAt: row.expires_at,
        approvedAt: new Date().toISOString(),
        email: user.email,
      };
    });
  } finally {
    await session.close();
  }
}

export async function getUserForApiToken(token: string): Promise<{
  userId: string;
  email: string;
  name?: string;
} | null> {
  const session = await openContext9DbSession();

  try {
    return session.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ApiTokenRow[]>`
        select
          token_row.user_id::text as user_id,
          user_row.email,
          user_row.name
        from context9.auth_api_tokens as token_row
        join context9.auth_users as user_row
          on user_row.id = token_row.user_id
        where
          token_row.token_hash = ${hashToken(token)}
          and token_row.revoked_at is null
        limit 1
      `;

      const row = rows[0];
      if (!row) {
        return null;
      }

      await tx.$executeRaw`
        update context9.auth_api_tokens
        set last_used_at = now()
        where token_hash = ${hashToken(token)}
      `;

      return {
        userId: row.user_id,
        email: row.email,
        name: row.name ?? undefined,
      };
    });
  } finally {
    await session.close();
  }
}
