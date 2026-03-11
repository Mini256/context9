import "server-only";

import {
  FileCredentialStore,
  instantDatabase,
  MemoryCredentialStore,
} from "get-db9";
import type { PrismaClient } from "@/generated/prisma/client";
import { optionalEnv } from "./env";
import { getPrismaClient } from "./prisma";

const SCHEMA_STATEMENTS = [
  `create schema if not exists context9`,
  `create table if not exists context9.projects (
    project_id uuid primary key,
    name text not null,
    root_hint text,
    default_branch text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists context9.contexts (
    context_id uuid primary key,
    project_id uuid not null references context9.projects(project_id) on delete cascade,
    name text not null,
    branch_name text not null,
    lock_machine_id text,
    lock_owner text,
    lock_worktree text,
    locked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(project_id, name),
    unique(project_id, branch_name)
  )`,
  `create table if not exists context9.tracked_files (
    project_id uuid not null references context9.projects(project_id) on delete cascade,
    path text not null,
    kind text not null,
    branch_scoped boolean not null default true,
    description text,
    provider text,
    reference text,
    acquire_prompt text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key(project_id, path)
  )`,
  `create table if not exists context9.tracked_keys (
    project_id uuid not null references context9.projects(project_id) on delete cascade,
    file_path text not null,
    key_name text not null,
    branch_scoped boolean not null default true,
    description text,
    provider text,
    reference text,
    acquire_prompt text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key(project_id, file_path, key_name),
    foreign key(project_id, file_path) references context9.tracked_files(project_id, path) on delete cascade
  )`,
  `create table if not exists context9.secret_entries (
    project_id uuid not null references context9.projects(project_id) on delete cascade,
    context_name text not null,
    file_path text not null,
    entry_name text not null,
    content_encoding text not null,
    iv text not null,
    auth_tag text not null,
    ciphertext text not null,
    checksum text not null,
    updated_at timestamptz not null default now(),
    primary key(project_id, context_name, file_path, entry_name)
  )`,
  `create index if not exists context9_secret_entries_by_scope
    on context9.secret_entries(project_id, file_path, context_name)`,
];

export interface Context9DbSession {
  databaseId: string;
  prisma: PrismaClient;
  authMode: "database-url" | "api-key" | "anonymous";
  close: () => Promise<void>;
}

async function buildCredentialStore():
  Promise<{ store?: MemoryCredentialStore | FileCredentialStore; authMode: "api-key" | "anonymous" }> {
  const apiKey = optionalEnv("DB9_API_KEY");

  if (apiKey) {
    const store = new MemoryCredentialStore();
    await store.save({
      token: apiKey,
    });

    return {
      store,
      authMode: "api-key",
    };
  }

  const credentialsPath = optionalEnv("CONTEXT9_DB9_CREDENTIALS_PATH");

  return {
    store: credentialsPath ? new FileCredentialStore(credentialsPath) : undefined,
    authMode: "anonymous",
  };
}

async function initializeSchema(prisma: PrismaClient): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function resolveDatabaseConnection():
  Promise<{ databaseId: string; databaseUrl: string; authMode: "database-url" | "api-key" | "anonymous" }> {
  const directDatabaseUrl =
    optionalEnv("CONTEXT9_DATABASE_URL") ?? optionalEnv("DATABASE_URL");

  if (directDatabaseUrl) {
    return {
      databaseId: "direct-database-url",
      databaseUrl: directDatabaseUrl,
      authMode: "database-url",
    };
  }

  const { store, authMode } = await buildCredentialStore();
  const database = await instantDatabase({
    name: optionalEnv("CONTEXT9_REMOTE_DATABASE_NAME") ?? "context9",
    baseUrl: optionalEnv("DB9_API_URL"),
    credentialStore: store,
  });

  return {
    databaseId: database.databaseId,
    databaseUrl: database.connectionString,
    authMode,
  };
}

export async function openContext9DbSession(): Promise<Context9DbSession> {
  const connection = await resolveDatabaseConnection();
  const prisma = getPrismaClient(connection.databaseUrl);
  await initializeSchema(prisma);

  return {
    databaseId: connection.databaseId,
    prisma,
    authMode: connection.authMode,
    close: async () => undefined,
  };
}
