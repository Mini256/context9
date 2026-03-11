import path from "node:path";
import {
  BLOB_ENTRY_NAME,
  SHARED_SCOPE,
  materializeDotenvFile,
  materializeSecretFile,
  readTrackedFile,
} from "./env-files.js";
import { decryptToText, encryptText } from "./crypto.js";
import type {
  Context9Config,
  Context9Credentials,
  DecryptedEntry,
  MachineIdentity,
  RemoteContextRecord,
  RemoteTreeRow,
  TrackedFileConfig,
} from "./types.js";

export interface RemoteSession {
  baseUrl: string;
  token: string;
  close: () => Promise<void>;
}

export interface DeviceAuthorizationStartResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  intervalSeconds: number;
}

export type DeviceAuthorizationPollResponse =
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

interface ApiAccessResponse {
  ok: boolean;
  mode: "service-token" | "api-token" | "session";
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
}

interface ApiEncryptedEntry {
  file_path: string;
  entry_name: string;
  context_name: string;
  content_encoding: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  checksum: string;
  updated_at: string;
}

function resolveApiUrl(credentials: Context9Credentials): string {
  const url =
    credentials.api_url ??
    process.env.CONTEXT9_API_URL ??
    "http://localhost:3000";

  return url.replace(/\/+$/, "");
}

function requireApiToken(credentials: Context9Credentials): string {
  const token = credentials.token ?? process.env.CONTEXT9_SERVICE_TOKEN;

  if (!token) {
    throw new Error(
      "No context9 API token found. Run `context9` or `context9 auth login` first.",
    );
  }

  return token;
}

async function anonymousApiRequest<T>(
  baseUrl: string,
  method: string,
  routePath: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${routePath}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      throw new Error(parsed.error);
    }

    throw new Error(`API request failed with status ${response.status}`);
  }

  return parsed as T;
}

async function apiRequest<T>(
  session: RemoteSession,
  method: string,
  routePath: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${session.baseUrl}${routePath}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      throw new Error(parsed.error);
    }

    throw new Error(`API request failed with status ${response.status}`);
  }

  return parsed as T;
}

function configToApiFiles(config: Context9Config) {
  return config.files.map((file) => ({
    path: file.path,
    kind: file.kind,
    branch_scoped: file.branch_scoped ?? true,
    description: file.description,
    provider: file.provider,
    reference: file.reference,
    acquire_prompt: file.acquire_prompt,
    keys: file.keys?.map((key) => ({
      name: key.name,
      branch_scoped: key.branch_scoped,
      description: key.description,
      provider: key.provider,
      reference: key.reference,
      acquire_prompt: key.acquire_prompt,
    })),
  }));
}

function decryptEntries(
  entries: ApiEncryptedEntry[],
  masterKey: string,
): DecryptedEntry[] {
  return entries.map((entry) => ({
    filePath: entry.file_path,
    entryName: entry.entry_name,
    scope: entry.context_name,
    contentEncoding: entry.content_encoding,
    value: decryptToText(
      {
        iv: entry.iv,
        authTag: entry.auth_tag,
        ciphertext: entry.ciphertext,
        checksum: entry.checksum,
      },
      masterKey,
    ),
  }));
}

export async function validateApiAccess(
  token: string,
  apiUrl?: string,
): Promise<{ mode: "service-token" | "api-token" | "session"; email?: string; name?: string }> {
  const session: RemoteSession = {
    baseUrl: (apiUrl ?? process.env.CONTEXT9_API_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    token,
    close: async () => undefined,
  };

  const response = await apiRequest<ApiAccessResponse>(
    session,
    "GET",
    "/api/auth/access",
  );

  return {
    mode: response.mode,
    email: response.user?.email ?? undefined,
    name: response.user?.name ?? undefined,
  };
}

export async function startDeviceAuthorization(
  apiUrl: string,
  input?: {
    machineId?: string;
    hostname?: string;
    clientName?: string;
  },
): Promise<DeviceAuthorizationStartResponse> {
  return anonymousApiRequest<DeviceAuthorizationStartResponse>(
    apiUrl,
    "POST",
    "/api/auth/device/start",
    input,
  );
}

export async function pollDeviceAuthorization(
  apiUrl: string,
  deviceCode: string,
): Promise<DeviceAuthorizationPollResponse> {
  return anonymousApiRequest<DeviceAuthorizationPollResponse>(
    apiUrl,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode,
    },
  );
}

export async function openRemoteSession(
  credentials: Context9Credentials,
): Promise<RemoteSession> {
  return {
    baseUrl: resolveApiUrl(credentials),
    token: requireApiToken(credentials),
    close: async () => undefined,
  };
}

export async function syncProjectDefinitions(
  session: RemoteSession,
  config: Context9Config,
  cwd: string,
): Promise<void> {
  await apiRequest(
    session,
    "PUT",
    `/api/projects/${encodeURIComponent(config.project_id)}`,
    {
      name: config.project_name,
      rootHint: cwd,
      defaultBranch: config.default_branch,
      files: configToApiFiles(config),
    },
  );
}

export async function ensureRemoteContext(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
  branchName: string,
): Promise<RemoteContextRecord> {
  const response = await apiRequest<{ context: RemoteContextRecord }>(
    session,
    "POST",
    `/api/projects/${encodeURIComponent(config.project_id)}/contexts`,
    {
      name: contextName,
      branchName,
    },
  );

  return response.context;
}

export async function acquireRemoteLock(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
  identity: MachineIdentity,
  worktreePath: string,
): Promise<RemoteContextRecord> {
  const response = await apiRequest<{ context: RemoteContextRecord }>(
    session,
    "POST",
    `/api/projects/${encodeURIComponent(config.project_id)}/contexts/${encodeURIComponent(contextName)}/lock`,
    {
      owner: `${identity.username}@${identity.hostname}`,
      machineId: identity.machineId,
      worktree: worktreePath,
    },
  );

  return response.context;
}

export async function listRemoteContexts(
  session: RemoteSession,
  config: Context9Config,
): Promise<RemoteContextRecord[]> {
  const response = await apiRequest<{ contexts: RemoteContextRecord[] }>(
    session,
    "GET",
    `/api/projects/${encodeURIComponent(config.project_id)}/contexts`,
  );

  return response.contexts;
}

export async function getRemoteContext(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
): Promise<RemoteContextRecord | null> {
  const contexts = await listRemoteContexts(session, config);
  return contexts.find((context) => context.name === contextName) ?? null;
}

export async function pushSecrets(
  session: RemoteSession,
  config: Context9Config,
  cwd: string,
  contextName: string,
  masterKey: string,
): Promise<{ uploadedFiles: number; uploadedEntries: number }> {
  let uploadedFiles = 0;
  let uploadedEntries = 0;
  const entries: Array<{
    file_path: string;
    entry_name: string;
    context_name: string;
    content_encoding: string;
    iv: string;
    auth_tag: string;
    ciphertext: string;
    checksum: string;
  }> = [];

  for (const file of config.files) {
    try {
      const fileEntries = await readTrackedFile(cwd, file);
      uploadedFiles += 1;

      for (const [entryName, payload] of fileEntries) {
        const encrypted = encryptText(payload.value, masterKey);
        const scope = payload.branchScoped ? contextName : SHARED_SCOPE;

        entries.push({
          file_path: file.path,
          entry_name: entryName,
          context_name: scope,
          content_encoding: payload.encoding,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          ciphertext: encrypted.ciphertext,
          checksum: encrypted.checksum,
        });
        uploadedEntries += 1;
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        continue;
      }

      throw error;
    }
  }

  await apiRequest(
    session,
    "PUT",
    `/api/projects/${encodeURIComponent(config.project_id)}/contexts/${encodeURIComponent(contextName)}/secrets`,
    {
      project: {
        name: config.project_name,
        rootHint: cwd,
        defaultBranch: config.default_branch,
      },
      branchName: contextName,
      files: configToApiFiles(config),
      entries,
    },
  );

  return { uploadedFiles, uploadedEntries };
}

async function fetchEncryptedEntries(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
  filePath?: string,
): Promise<ApiEncryptedEntry[]> {
  const search = new URLSearchParams();
  if (filePath) {
    search.set("filePath", filePath);
  }

  const response = await apiRequest<{ entries: ApiEncryptedEntry[] }>(
    session,
    "GET",
    `/api/projects/${encodeURIComponent(config.project_id)}/contexts/${encodeURIComponent(contextName)}/secrets${search.toString() ? `?${search.toString()}` : ""}`,
  );

  return response.entries;
}

export async function materializeTrackedFiles(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
  masterKey: string,
): Promise<
  Array<{
    file: TrackedFileConfig;
    materialized:
      | ReturnType<typeof materializeDotenvFile>
      | ReturnType<typeof materializeSecretFile>;
  }>
> {
  const entries = decryptEntries(
    await fetchEncryptedEntries(session, config, contextName),
    masterKey,
  );
  const fileEntries = new Map<string, DecryptedEntry[]>();

  for (const entry of entries) {
    const bucket = fileEntries.get(entry.filePath) ?? [];
    bucket.push(entry);
    fileEntries.set(entry.filePath, bucket);
  }

  const materialized = [];

  for (const file of config.files) {
    const bucket = fileEntries.get(file.path) ?? [];

    if (file.kind === "dotenv") {
      const shared = new Map<string, string>();
      const scoped = new Map<string, string>();

      for (const entry of bucket) {
        if (entry.entryName === BLOB_ENTRY_NAME) {
          continue;
        }

        if (entry.scope === SHARED_SCOPE) {
          shared.set(entry.entryName, entry.value);
        } else {
          scoped.set(entry.entryName, entry.value);
        }
      }

      materialized.push({
        file,
        materialized: materializeDotenvFile(file, shared, scoped),
      });
      continue;
    }

    const sharedBlob = bucket.find(
      (entry) => entry.scope === SHARED_SCOPE && entry.entryName === BLOB_ENTRY_NAME,
    )?.value;
    const scopedBlob = bucket.find(
      (entry) => entry.scope === contextName && entry.entryName === BLOB_ENTRY_NAME,
    )?.value;

    if (!sharedBlob && !scopedBlob) {
      continue;
    }

    materialized.push({
      file,
      materialized: materializeSecretFile(file, sharedBlob, scopedBlob),
    });
  }

  return materialized;
}

export async function listRemoteTree(
  session: RemoteSession,
  config: Context9Config,
): Promise<RemoteTreeRow[]> {
  const response = await apiRequest<{ tree: RemoteTreeRow[] }>(
    session,
    "GET",
    `/api/projects/${encodeURIComponent(config.project_id)}/remote/tree`,
  );

  return response.tree;
}

export async function inspectRemoteFile(
  session: RemoteSession,
  config: Context9Config,
  contextName: string,
  filePath: string,
  masterKey: string,
): Promise<string> {
  const trackedFile = config.files.find((file) => file.path === filePath);
  if (!trackedFile) {
    throw new Error(`File "${filePath}" is not tracked in context9.toml`);
  }

  const params = new URLSearchParams({
    contextName,
    filePath,
  });

  const response = await apiRequest<{ entries: ApiEncryptedEntry[] }>(
    session,
    "GET",
    `/api/projects/${encodeURIComponent(config.project_id)}/remote/inspect?${params.toString()}`,
  );

  const entries = decryptEntries(response.entries, masterKey);
  const bucket = entries.filter((entry) => entry.filePath === filePath);

  if (trackedFile.kind === "dotenv") {
    const shared = new Map<string, string>();
    const scoped = new Map<string, string>();

    for (const entry of bucket) {
      if (entry.entryName === BLOB_ENTRY_NAME) {
        continue;
      }

      if (entry.scope === SHARED_SCOPE) {
        shared.set(entry.entryName, entry.value);
      } else {
        scoped.set(entry.entryName, entry.value);
      }
    }

    return materializeDotenvFile(trackedFile, shared, scoped).content as string;
  }

  const sharedBlob = bucket.find(
    (entry) => entry.scope === SHARED_SCOPE && entry.entryName === BLOB_ENTRY_NAME,
  )?.value;
  const scopedBlob = bucket.find(
    (entry) => entry.scope === contextName && entry.entryName === BLOB_ENTRY_NAME,
  )?.value;
  const content = materializeSecretFile(trackedFile, sharedBlob, scopedBlob).content;

  return typeof content === "string" ? content : content.toString("utf8");
}

export async function inferRemoteContextName(
  session: RemoteSession,
  config: Context9Config,
  requestedContextName: string | undefined,
): Promise<string> {
  if (requestedContextName) {
    return requestedContextName;
  }

  const current = config.current_context_name;
  if (current) {
    return current;
  }

  const contexts = await listRemoteContexts(session, config);
  return contexts[0]?.name ?? config.default_branch;
}

export function formatLockOwner(context: RemoteContextRecord): string {
  if (!context.lock_owner) {
    return "unlocked";
  }

  const location = context.lock_worktree ? ` @ ${path.basename(context.lock_worktree)}` : "";
  return `${context.lock_owner}${location}`;
}
