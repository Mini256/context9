import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as TOML from "@iarna/toml";
import { getProjectConfigPath } from "./paths.js";
import type { Context9Config, KeyRule, TrackedFileConfig } from "./types.js";

function normalizeKeyRule(input: unknown): KeyRule {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid key rule in context9.toml");
  }

  const value = input as Record<string, unknown>;
  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new Error("Each key rule must include a non-empty name");
  }

  return {
    name: value.name,
    branch_scoped: typeof value.branch_scoped === "boolean" ? value.branch_scoped : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    provider: typeof value.provider === "string" ? value.provider : undefined,
    reference: typeof value.reference === "string" ? value.reference : undefined,
    acquire_prompt: typeof value.acquire_prompt === "string" ? value.acquire_prompt : undefined,
  };
}

function normalizeTrackedFile(input: unknown): TrackedFileConfig {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid tracked file entry in context9.toml");
  }

  const value = input as Record<string, unknown>;
  if (typeof value.path !== "string" || !value.path.trim()) {
    throw new Error("Each tracked file entry must include a non-empty path");
  }

  const kind = value.kind === "secret_file" ? "secret_file" : "dotenv";

  return {
    path: value.path,
    kind,
    branch_scoped: typeof value.branch_scoped === "boolean" ? value.branch_scoped : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    provider: typeof value.provider === "string" ? value.provider : undefined,
    reference: typeof value.reference === "string" ? value.reference : undefined,
    acquire_prompt: typeof value.acquire_prompt === "string" ? value.acquire_prompt : undefined,
    keys: Array.isArray(value.keys) ? value.keys.map(normalizeKeyRule) : undefined,
  };
}

export function createDefaultConfig(cwd: string, trackedFiles: TrackedFileConfig[] = []): Context9Config {
  return {
    version: 1,
    project_id: randomUUID(),
    project_name: path.basename(cwd),
    current_context_name: "main",
    remote_database_name: "context9",
    default_branch: "main",
    files: trackedFiles,
  };
}

export async function loadConfig(cwd: string): Promise<Context9Config> {
  const configPath = getProjectConfigPath(cwd);
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = TOML.parse(raw) as Record<string, unknown>;

  const files = Array.isArray(parsed.files) ? parsed.files.map(normalizeTrackedFile) : [];

  if (typeof parsed.project_id !== "string" || !parsed.project_id) {
    throw new Error(`Missing project_id in ${configPath}`);
  }

  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    project_id: parsed.project_id,
    project_name: typeof parsed.project_name === "string" ? parsed.project_name : path.basename(cwd),
    current_context_name:
      typeof parsed.current_context_name === "string" ? parsed.current_context_name : undefined,
    remote_database_name:
      typeof parsed.remote_database_name === "string" ? parsed.remote_database_name : "context9",
    default_branch: typeof parsed.default_branch === "string" ? parsed.default_branch : "main",
    files,
  };
}

export async function saveConfig(cwd: string, config: Context9Config): Promise<string> {
  const configPath = getProjectConfigPath(cwd);
  const payload = TOML.stringify({
    version: config.version,
    project_id: config.project_id,
    project_name: config.project_name,
    ...(config.current_context_name ? { current_context_name: config.current_context_name } : {}),
    remote_database_name: config.remote_database_name,
    default_branch: config.default_branch,
    files: config.files.map((file) => ({
      path: file.path,
      kind: file.kind,
      branch_scoped: file.branch_scoped ?? true,
      ...(file.description ? { description: file.description } : {}),
      ...(file.provider ? { provider: file.provider } : {}),
      ...(file.reference ? { reference: file.reference } : {}),
      ...(file.acquire_prompt ? { acquire_prompt: file.acquire_prompt } : {}),
      ...(file.keys
        ? {
            keys: file.keys.map((key) => ({
              name: key.name,
              ...(typeof key.branch_scoped === "boolean"
                ? { branch_scoped: key.branch_scoped }
                : {}),
              ...(key.description ? { description: key.description } : {}),
              ...(key.provider ? { provider: key.provider } : {}),
              ...(key.reference ? { reference: key.reference } : {}),
              ...(key.acquire_prompt ? { acquire_prompt: key.acquire_prompt } : {}),
            })),
          }
        : {}),
    })),
  } as unknown as TOML.JsonMap);

  await fs.writeFile(configPath, payload, "utf8");
  return configPath;
}
