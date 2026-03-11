import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import * as TOML from "@iarna/toml";
import { getContext9Home, getCredentialsPath } from "./paths.js";
import type { Context9Credentials, MachineIdentity } from "./types.js";

async function ensureHome(): Promise<void> {
  await fs.mkdir(getContext9Home(), { recursive: true });
}

export async function loadCredentials(): Promise<Context9Credentials> {
  const credentialsPath = getCredentialsPath();

  try {
    const raw = await fs.readFile(credentialsPath, "utf8");
    return TOML.parse(raw) as Context9Credentials;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function saveCredentials(credentials: Context9Credentials): Promise<string> {
  await ensureHome();

  const credentialsPath = getCredentialsPath();
  const payload = TOML.stringify({
    ...(credentials.token ? { token: credentials.token } : {}),
    ...(credentials.master_key ? { master_key: credentials.master_key } : {}),
    ...(credentials.api_url ? { api_url: credentials.api_url } : {}),
    ...(credentials.machine_id ? { machine_id: credentials.machine_id } : {}),
    ...(credentials.last_login_at ? { last_login_at: credentials.last_login_at } : {}),
  } as unknown as TOML.JsonMap);
  await fs.writeFile(credentialsPath, payload, { encoding: "utf8", mode: 0o600 });
  return credentialsPath;
}

export async function clearCredentials(): Promise<void> {
  await saveCredentials({});
}

export async function getMachineIdentity(): Promise<MachineIdentity> {
  const credentials = await loadCredentials();
  let machineId = credentials.machine_id;

  if (!machineId) {
    machineId = randomUUID();
    await saveCredentials({
      ...credentials,
      machine_id: machineId,
    });
  }

  return {
    machineId,
    hostname: process.env.HOSTNAME ?? process.env.COMPUTERNAME ?? "unknown-host",
    username: process.env.USER ?? process.env.USERNAME ?? "unknown-user",
  };
}
