import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export const SHARED_SCOPE = "__shared__";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ApiProject {
  project_id: string;
  name: string;
  root_hint: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface ApiContext {
  context_id: string;
  name: string;
  branch_name: string;
  lock_machine_id: string | null;
  lock_owner: string | null;
  lock_worktree: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiTrackedKey {
  name: string;
  branch_scoped?: boolean;
  description?: string;
  provider?: string;
  reference?: string;
  acquire_prompt?: string;
}

export interface ApiTrackedFile {
  path: string;
  kind: "dotenv" | "secret_file";
  branch_scoped?: boolean;
  description?: string;
  provider?: string;
  reference?: string;
  acquire_prompt?: string;
  keys?: ApiTrackedKey[];
}

export interface ApiEncryptedEntry {
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

export interface ApiRemoteTreeRow {
  path: string;
  kind: "dotenv" | "secret_file";
  branch_scoped: boolean;
  shared_entries: number;
  context_entries: number;
  context_count: number;
}

export async function upsertProject(
  db: DbClient,
  input: {
    projectId: string;
    name: string;
    rootHint?: string;
    defaultBranch?: string;
  },
): Promise<ApiProject> {
  const rows = await db.$queryRaw<ApiProject[]>`
    insert into context9.projects (
      project_id,
      name,
      root_hint,
      default_branch
    )
    values (
      ${input.projectId}::uuid,
      ${input.name},
      ${input.rootHint ?? null},
      ${input.defaultBranch ?? "main"}
    )
    on conflict (project_id)
    do update set
      name = excluded.name,
      root_hint = excluded.root_hint,
      default_branch = excluded.default_branch,
      updated_at = now()
    returning
      project_id::text,
      name,
      root_hint,
      default_branch,
      created_at::text,
      updated_at::text
  `;

  return rows[0];
}

export async function syncTrackedDefinitions(
  db: DbClient,
  input: {
    projectId: string;
    files: ApiTrackedFile[];
  },
): Promise<void> {
  for (const file of input.files) {
    await db.$executeRaw`
      insert into context9.tracked_files (
        project_id,
        path,
        kind,
        branch_scoped,
        description,
        provider,
        reference,
        acquire_prompt
      )
      values (
        ${input.projectId}::uuid,
        ${file.path},
        ${file.kind},
        ${file.branch_scoped ?? true},
        ${file.description ?? null},
        ${file.provider ?? null},
        ${file.reference ?? null},
        ${file.acquire_prompt ?? null}
      )
      on conflict (project_id, path)
      do update set
        kind = excluded.kind,
        branch_scoped = excluded.branch_scoped,
        description = excluded.description,
        provider = excluded.provider,
        reference = excluded.reference,
        acquire_prompt = excluded.acquire_prompt,
        updated_at = now()
    `;

    for (const key of file.keys ?? []) {
      await db.$executeRaw`
        insert into context9.tracked_keys (
          project_id,
          file_path,
          key_name,
          branch_scoped,
          description,
          provider,
          reference,
          acquire_prompt
        )
        values (
          ${input.projectId}::uuid,
          ${file.path},
          ${key.name},
          ${key.branch_scoped ?? file.branch_scoped ?? true},
          ${key.description ?? null},
          ${key.provider ?? file.provider ?? null},
          ${key.reference ?? file.reference ?? null},
          ${key.acquire_prompt ?? file.acquire_prompt ?? null}
        )
        on conflict (project_id, file_path, key_name)
        do update set
          branch_scoped = excluded.branch_scoped,
          description = excluded.description,
          provider = excluded.provider,
          reference = excluded.reference,
          acquire_prompt = excluded.acquire_prompt,
          updated_at = now()
      `;
    }
  }
}

export async function ensureContext(
  db: DbClient,
  input: {
    projectId: string;
    contextName: string;
    branchName?: string;
  },
): Promise<ApiContext> {
  const branchName = input.branchName ?? input.contextName;
  const contextId = randomUUID();
  const rows = await db.$queryRaw<ApiContext[]>`
    insert into context9.contexts (
      context_id,
      project_id,
      name,
      branch_name
    )
    values (
      ${contextId}::uuid,
      ${input.projectId}::uuid,
      ${input.contextName},
      ${branchName}
    )
    on conflict (project_id, name)
    do update set
      branch_name = excluded.branch_name,
      updated_at = now()
    returning
      context_id::text,
      name,
      branch_name,
      lock_machine_id,
      lock_owner,
      lock_worktree,
      locked_at::text,
      created_at::text,
      updated_at::text
  `;

  return rows[0];
}

export async function listContexts(
  db: DbClient,
  projectId: string,
): Promise<ApiContext[]> {
  return db.$queryRaw<ApiContext[]>`
    select
      context_id::text,
      name,
      branch_name,
      lock_machine_id,
      lock_owner,
      lock_worktree,
      locked_at::text,
      created_at::text,
      updated_at::text
    from context9.contexts
    where project_id = ${projectId}::uuid
    order by name asc
  `;
}

export async function acquireContextLock(
  db: DbClient,
  input: {
    projectId: string;
    contextName: string;
    owner: string;
    machineId: string;
    worktree: string;
  },
): Promise<ApiContext> {
  const rows = await db.$queryRaw<ApiContext[]>`
    update context9.contexts
    set
      lock_machine_id = ${input.machineId},
      lock_owner = ${input.owner},
      lock_worktree = ${input.worktree},
      locked_at = now(),
      updated_at = now()
    where
      project_id = ${input.projectId}::uuid
      and name = ${input.contextName}
      and (
        lock_machine_id is null
        or (
          lock_machine_id = ${input.machineId}
          and lock_worktree = ${input.worktree}
        )
      )
    returning
      context_id::text,
      name,
      branch_name,
      lock_machine_id,
      lock_owner,
      lock_worktree,
      locked_at::text,
      created_at::text,
      updated_at::text
  `;

  if (rows[0]) {
    return rows[0];
  }

  const existing = await db.$queryRaw<ApiContext[]>`
    select
      context_id::text,
      name,
      branch_name,
      lock_machine_id,
      lock_owner,
      lock_worktree,
      locked_at::text,
      created_at::text,
      updated_at::text
    from context9.contexts
    where project_id = ${input.projectId}::uuid and name = ${input.contextName}
    limit 1
  `;

  if (!existing[0]) {
    throw new Error(`Context "${input.contextName}" does not exist.`);
  }

  throw new Error(
    `Context "${input.contextName}" is already locked by ${existing[0].lock_owner ?? "another owner"}.`,
  );
}

export async function upsertSecretEntries(
  db: DbClient,
  input: {
    projectId: string;
    entries: Omit<ApiEncryptedEntry, "updated_at">[];
  },
): Promise<number> {
  for (const entry of input.entries) {
    await db.$executeRaw`
      insert into context9.secret_entries (
        project_id,
        context_name,
        file_path,
        entry_name,
        content_encoding,
        iv,
        auth_tag,
        ciphertext,
        checksum
      )
      values (
        ${input.projectId}::uuid,
        ${entry.context_name},
        ${entry.file_path},
        ${entry.entry_name},
        ${entry.content_encoding},
        ${entry.iv},
        ${entry.auth_tag},
        ${entry.ciphertext},
        ${entry.checksum}
      )
      on conflict (project_id, context_name, file_path, entry_name)
      do update set
        content_encoding = excluded.content_encoding,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        ciphertext = excluded.ciphertext,
        checksum = excluded.checksum,
        updated_at = now()
    `;
  }

  return input.entries.length;
}

export async function listSecretEntries(
  db: DbClient,
  input: {
    projectId: string;
    contextName: string;
    filePath?: string;
  },
): Promise<ApiEncryptedEntry[]> {
  if (input.filePath) {
    return db.$queryRaw<ApiEncryptedEntry[]>`
      select
        file_path,
        entry_name,
        context_name,
        content_encoding,
        iv,
        auth_tag,
        ciphertext,
        checksum,
        updated_at::text
      from context9.secret_entries
      where
        project_id = ${input.projectId}::uuid
        and context_name in (${SHARED_SCOPE}, ${input.contextName})
        and file_path = ${input.filePath}
      order by file_path, entry_name
    `;
  }

  return db.$queryRaw<ApiEncryptedEntry[]>`
    select
      file_path,
      entry_name,
      context_name,
      content_encoding,
      iv,
      auth_tag,
      ciphertext,
      checksum,
      updated_at::text
    from context9.secret_entries
    where
      project_id = ${input.projectId}::uuid
      and context_name in (${SHARED_SCOPE}, ${input.contextName})
    order by file_path, entry_name
  `;
}

export async function listRemoteTree(
  db: DbClient,
  projectId: string,
): Promise<ApiRemoteTreeRow[]> {
  return db.$queryRaw<ApiRemoteTreeRow[]>`
    select
      tracked.path as path,
      tracked.kind as kind,
      tracked.branch_scoped as branch_scoped,
      count(*) filter (where secret.context_name = ${SHARED_SCOPE})::int as shared_entries,
      count(*) filter (where secret.context_name <> ${SHARED_SCOPE})::int as context_entries,
      count(distinct case when secret.context_name <> ${SHARED_SCOPE} then secret.context_name end)::int as context_count
    from context9.tracked_files as tracked
    left join context9.secret_entries as secret
      on tracked.project_id = secret.project_id
      and tracked.path = secret.file_path
    where tracked.project_id = ${projectId}::uuid
    group by tracked.path, tracked.kind, tracked.branch_scoped
    order by tracked.path asc
  `;
}
