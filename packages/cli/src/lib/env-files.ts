import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import type { KeyRule, MaterializedFile, TrackedFileConfig } from "./types.js";

const SHARED_SCOPE = "__shared__";
const BLOB_ENTRY_NAME = "__blob__";

export { BLOB_ENTRY_NAME, SHARED_SCOPE };

export function normalizeRuleBranchScope(
  file: TrackedFileConfig,
  keyRule?: KeyRule,
): boolean {
  if (typeof keyRule?.branch_scoped === "boolean") {
    return keyRule.branch_scoped;
  }

  return typeof file.branch_scoped === "boolean" ? file.branch_scoped : true;
}

export async function discoverTrackedFiles(cwd: string): Promise<TrackedFileConfig[]> {
  const candidates: TrackedFileConfig[] = [];
  const rootEntries = await fs.readdir(cwd, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (!entry.isFile()) {
      continue;
    }

    if (entry.name === ".env" || entry.name.startsWith(".env.")) {
      candidates.push({
        path: entry.name,
        kind: "dotenv",
        branch_scoped: true,
        description: "Discovered environment file",
      });
      continue;
    }

    if (
      entry.name.endsWith(".pem") ||
      entry.name.endsWith(".key") ||
      entry.name === "id_rsa" ||
      entry.name === "id_ed25519"
    ) {
      candidates.push({
        path: entry.name,
        kind: "secret_file",
        branch_scoped: true,
        description: "Discovered secret file",
      });
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      path: ".env",
      kind: "dotenv",
      branch_scoped: true,
      description: "Primary application environment",
      keys: [
        {
          name: "DATABASE_URL",
          branch_scoped: true,
          description: "Branch-specific database connection string",
          provider: "tidbcloud",
          reference: "providers/tidbcloud.md",
          acquire_prompt:
            "This value should point at a TiDB Cloud branch dedicated to the current git/worktree context.",
        },
      ],
    });
  }

  return candidates;
}

export async function readTrackedFile(
  cwd: string,
  file: TrackedFileConfig,
): Promise<Map<string, { value: string; branchScoped: boolean; encoding: string }>> {
  const absolutePath = path.join(cwd, file.path);
  const entries = new Map<string, { value: string; branchScoped: boolean; encoding: string }>();

  if (file.kind === "dotenv") {
    const raw = await fs.readFile(absolutePath, "utf8");
    const parsed = parseDotenv(raw);

    for (const [name, value] of Object.entries(parsed)) {
      const keyRule = file.keys?.find((candidate) => candidate.name === name);
      entries.set(name, {
        value,
        branchScoped: normalizeRuleBranchScope(file, keyRule),
        encoding: "utf8",
      });
    }

    return entries;
  }

  const buffer = await fs.readFile(absolutePath);
  entries.set(BLOB_ENTRY_NAME, {
    value: buffer.toString("base64"),
    branchScoped: typeof file.branch_scoped === "boolean" ? file.branch_scoped : true,
    encoding: "base64",
  });

  return entries;
}

export function materializeDotenvFile(
  file: TrackedFileConfig,
  sharedEntries: Map<string, string>,
  contextEntries: Map<string, string>,
): MaterializedFile {
  const lines: string[] = [];
  const seen = new Set<string>();
  const orderedKeys = [
    ...(file.keys?.map((key) => key.name) ?? []),
    ...Array.from(sharedEntries.keys()),
    ...Array.from(contextEntries.keys()),
  ];

  for (const key of orderedKeys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const value = contextEntries.get(key) ?? sharedEntries.get(key);
    if (value === undefined) {
      continue;
    }

    lines.push(`${key}=${value}`);
  }

  return {
    path: file.path,
    kind: file.kind,
    content: lines.join("\n") + (lines.length > 0 ? "\n" : ""),
  };
}

export function materializeSecretFile(
  file: TrackedFileConfig,
  sharedValue: string | undefined,
  contextValue: string | undefined,
): MaterializedFile {
  const value = contextValue ?? sharedValue;

  return {
    path: file.path,
    kind: file.kind,
    content: Buffer.from(value ?? "", "base64"),
  };
}

export async function writeMaterializedFile(cwd: string, file: MaterializedFile): Promise<void> {
  const absolutePath = path.join(cwd, file.path);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  if (typeof file.content === "string") {
    await fs.writeFile(absolutePath, file.content, "utf8");
    return;
  }

  await fs.writeFile(absolutePath, file.content);
}
