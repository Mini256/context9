#!/usr/bin/env node

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import pc from "picocolors";
import { Command } from "commander";
import { generateMasterKey } from "./lib/crypto.js";
import {
  createDefaultConfig,
  loadConfig,
  saveConfig,
} from "./lib/config.js";
import {
  clearCredentials,
  getMachineIdentity,
  loadCredentials,
  saveCredentials,
} from "./lib/credentials.js";
import {
  discoverTrackedFiles,
  writeMaterializedFile,
} from "./lib/env-files.js";
import {
  branchExists,
  checkoutBranch,
  ensureGitRepository,
  getCurrentBranch,
} from "./lib/git.js";
import { getProjectConfigPath } from "./lib/paths.js";
import {
  acquireRemoteLock,
  ensureRemoteContext,
  formatLockOwner,
  inspectRemoteFile,
  listRemoteContexts,
  listRemoteTree,
  materializeTrackedFiles,
  openRemoteSession,
  pollDeviceAuthorization,
  pushSecrets,
  startDeviceAuthorization,
  syncProjectDefinitions,
  validateApiAccess,
  DEFAULT_API_BASE_URL,
} from "./lib/remote.js";
import type { Context9Config, Context9Credentials, KeyRule, TrackedFileConfig } from "./lib/types.js";

function info(message: string): void {
  console.log(pc.cyan(message));
}

function success(message: string): void {
  console.log(pc.green(message));
}

function warn(message: string): void {
  console.log(pc.yellow(message));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function openBrowser(url: string): boolean {
  try {
    if (process.platform === "darwin") {
      const child = spawn("open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }

    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }

    const child = spawn("xdg-open", [url], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function requireConfig(cwd: string): Promise<Context9Config> {
  const configPath = getProjectConfigPath(cwd);

  if (!(await fileExists(configPath))) {
    throw new Error(`Missing ${configPath}. Run \`context9 init\` first.`);
  }

  return loadConfig(cwd);
}

async function resolveSecretMaterial(cwd: string): Promise<{
  config: Context9Config;
  credentials: Context9Credentials;
  masterKey: string;
}> {
  const config = await requireConfig(cwd);
  const credentials = await loadCredentials();
  const masterKey = process.env.CONTEXT9_MASTER_KEY ?? credentials.master_key ?? generateMasterKey();

  if (!credentials.master_key && !process.env.CONTEXT9_MASTER_KEY) {
    await saveCredentials({
      ...credentials,
      master_key: masterKey,
    });
  }

  return {
    config,
    credentials: {
      ...credentials,
      master_key: masterKey,
    },
    masterKey,
  };
}

async function resolveContextName(cwd: string, config: Context9Config, requested?: string): Promise<string> {
  if (requested) {
    return requested;
  }

  const branch = await getCurrentBranch(cwd);
  return branch ?? config.current_context_name ?? config.default_branch;
}

async function loginWithDeviceCode(apiUrl: string): Promise<void> {
  const existing = await loadCredentials();
  const identity = await getMachineIdentity();
  const started = await startDeviceAuthorization(apiUrl, {
    machineId: identity.machineId,
    hostname: identity.hostname,
    clientName: "context9-cli",
  });

  info(`Open this URL to continue: ${started.verificationUrl}`);
  info(`Code: ${started.userCode}`);

  if (openBrowser(started.verificationUrl)) {
    success("Opened browser for device login.");
  } else {
    warn("Could not open a browser automatically.");
  }

  while (Date.now() < new Date(started.expiresAt).valueOf()) {
    const polled = await pollDeviceAuthorization(apiUrl, started.deviceCode);

    if (polled.status === "approved") {
      const profile = await validateApiAccess(polled.accessToken, apiUrl);
      const masterKey =
        process.env.CONTEXT9_MASTER_KEY ??
        existing.master_key ??
        generateMasterKey();

      await saveCredentials({
        ...existing,
        token: polled.accessToken,
        api_url: apiUrl,
        master_key: masterKey,
        last_login_at: new Date().toISOString(),
      });

      success(
        `Authenticated against context9 API at ${apiUrl}${profile.email ? ` as ${profile.email}` : profile.name ? ` as ${profile.name}` : ""}.`,
      );
      return;
    }

    if (polled.status === "expired" || polled.status === "not_found") {
      throw new Error("Device login expired. Run `context9 auth login` again.");
    }

    if (polled.status === "pending") {
      await sleep(polled.intervalSeconds * 1000);
    }
  }

  throw new Error("Device login timed out. Run `context9 auth login` again.");
}

function renderManifest(config: Context9Config, contextName: string): string {
  const lines = [
    "# context9 manifest",
    "",
    `project_name: ${config.project_name}`,
    `project_id: ${config.project_id}`,
    `current_context: ${contextName}`,
    `default_branch: ${config.default_branch}`,
    "",
  ];

  for (const file of config.files) {
    lines.push(`## ${file.path}`);
    lines.push(`kind: ${file.kind}`);
    lines.push(`default_scope: ${(file.branch_scoped ?? true) ? "context" : "shared"}`);
    if (file.description) {
      lines.push(`description: ${file.description}`);
    }
    if (file.provider) {
      lines.push(`provider: ${file.provider}`);
    }
    if (file.reference) {
      lines.push(`reference: ${file.reference}`);
    }
    if (file.acquire_prompt) {
      lines.push(`acquire_prompt: ${file.acquire_prompt}`);
    }

    if (file.kind === "dotenv") {
      const keys = file.keys ?? [];
      if (keys.length === 0) {
        lines.push("entries:");
        lines.push("- <auto-discovered keys will appear here after push>");
      } else {
        lines.push("entries:");
        for (const key of keys) {
          lines.push(
            `- ${key.name}=<${(key.branch_scoped ?? file.branch_scoped ?? true) ? "context" : "shared"}-secret>`,
          );
          if (key.description) {
            lines.push(`  description: ${key.description}`);
          }
          if (key.provider ?? file.provider) {
            lines.push(`  provider: ${key.provider ?? file.provider}`);
          }
          if (key.reference ?? file.reference) {
            lines.push(`  reference: ${key.reference ?? file.reference}`);
          }
          if (key.acquire_prompt ?? file.acquire_prompt) {
            lines.push(`  acquire_prompt: ${key.acquire_prompt ?? file.acquire_prompt}`);
          }
        }
      }
    } else {
      lines.push(
        `entries:\n- ${path.basename(file.path)}=<${(file.branch_scoped ?? true) ? "context" : "shared"}-secret-file>`,
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}

async function writeDotenvValue(
  cwd: string,
  config: Context9Config,
  filePath: string,
  pairs: string[],
  metadata: {
    branchScoped?: boolean;
    description?: string;
    provider?: string;
    reference?: string;
    acquirePrompt?: string;
  },
): Promise<void> {
  const tracked = config.files.find((file) => file.path === filePath);

  if (!tracked) {
    throw new Error(`File "${filePath}" is not tracked. Add it to context9.toml first or run \`context9 init\`.`);
  }

  if (tracked.kind !== "dotenv") {
    throw new Error(`File "${filePath}" is tracked as ${tracked.kind}, not dotenv.`);
  }

  const absolutePath = path.join(cwd, filePath);
  let current: Record<string, string> = {};

  if (await fileExists(absolutePath)) {
    current = parseDotenv(await fs.readFile(absolutePath, "utf8"));
  }

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    if (!key || valueParts.length === 0) {
      throw new Error(`Invalid --env pair "${pair}". Expected KEY=VALUE.`);
    }

    const value = valueParts.join("=");
    current[key] = value;

    const existingRule = tracked.keys?.find((candidate) => candidate.name === key);
    if (!existingRule) {
      const newRule: KeyRule = {
        name: key,
        branch_scoped:
          typeof metadata.branchScoped === "boolean"
            ? metadata.branchScoped
            : tracked.branch_scoped ?? true,
        description: metadata.description,
        provider: metadata.provider,
        reference: metadata.reference,
        acquire_prompt: metadata.acquirePrompt,
      };
      tracked.keys = [...(tracked.keys ?? []), newRule];
    }
  }

  const lines = Object.entries(current)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, lines.join("\n") + "\n", "utf8");
}

async function pullIntoWorkspace(
  cwd: string,
  config: Context9Config,
  credentials: Context9Credentials,
  masterKey: string,
  contextName: string,
): Promise<number> {
  const session = await openRemoteSession(credentials);

  try {
    await syncProjectDefinitions(session, config, cwd);
    await ensureRemoteContext(session, config, contextName, contextName);
    const materialized = await materializeTrackedFiles(session, config, contextName, masterKey);

    for (const item of materialized) {
      await writeMaterializedFile(cwd, item.materialized);
    }

    return materialized.length;
  } finally {
    await session.close();
  }
}

async function pushFromWorkspace(
  cwd: string,
  config: Context9Config,
  credentials: Context9Credentials,
  masterKey: string,
  contextName: string,
): Promise<{ uploadedFiles: number; uploadedEntries: number }> {
  const session = await openRemoteSession(credentials);

  try {
    await syncProjectDefinitions(session, config, cwd);
    await ensureRemoteContext(session, config, contextName, contextName);
    return pushSecrets(session, config, cwd, contextName, masterKey);
  } finally {
    await session.close();
  }
}

async function maybeLockContext(
  cwd: string,
  config: Context9Config,
  credentials: Context9Credentials,
  contextName: string,
): Promise<void> {
  const session = await openRemoteSession(credentials);

  try {
    const identity = await getMachineIdentity();
    await syncProjectDefinitions(session, config, cwd);
    await ensureRemoteContext(session, config, contextName, contextName);
    await acquireRemoteLock(session, config, contextName, identity, cwd);
  } finally {
    await session.close();
  }
}

async function buildRuntimeEnv(cwd: string, config: Context9Config): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const file of config.files) {
    if (file.kind !== "dotenv") {
      continue;
    }

    const absolutePath = path.join(cwd, file.path);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const parsed = parseDotenv(await fs.readFile(absolutePath, "utf8"));
    Object.assign(result, parsed);
  }

  return result;
}

const program = new Command();

program
  .name("context9")
  .description("Agent-oriented context and secret manager using a Next.js API over db9")
  .version("0.1.0");

const auth = program.command("auth").description("Manage context9 API credentials");

auth
  .command("login")
  .description("Sign in to context9")
  .option("--token <token>", "context9 API token")
  .option("--api-url <url>", `context9 API base URL, for example ${DEFAULT_API_BASE_URL}`)
  .action(async (options: { token?: string; apiUrl?: string }) => {
    const existing = await loadCredentials();
    const apiUrl =
      options.apiUrl ??
      process.env.CONTEXT9_API_URL ??
      existing.api_url ??
      DEFAULT_API_BASE_URL;
    const token = options.token ?? process.env.CONTEXT9_SERVICE_TOKEN;

    if (!token) {
      await loginWithDeviceCode(apiUrl);
      return;
    }

    const profile = await validateApiAccess(token, apiUrl);
    const masterKey = process.env.CONTEXT9_MASTER_KEY ?? existing.master_key ?? generateMasterKey();

    await saveCredentials({
      ...existing,
      token,
      api_url: apiUrl,
      master_key: masterKey,
      last_login_at: new Date().toISOString(),
    });

    success(
      `Authenticated against context9 API at ${apiUrl}${profile.email ? ` as ${profile.email}` : profile.name ? ` as ${profile.name}` : ""}.`,
    );
  });

auth
  .command("logout")
  .description("Clear the stored context9 API token")
  .action(async () => {
    const existing = await loadCredentials();
    await clearCredentials();

    if (existing.master_key || existing.machine_id || existing.api_url) {
      await saveCredentials({
        master_key: existing.master_key,
        machine_id: existing.machine_id,
        api_url: existing.api_url,
      });
    }

    success("Stored context9 API token cleared.");
  });

program
  .command("init")
  .description("Initialize context9 in the current project")
  .option("--force", "overwrite an existing context9.toml")
  .action(async (options: { force?: boolean }) => {
    const cwd = process.cwd();
    const configPath = getProjectConfigPath(cwd);

    if (!options.force && (await fileExists(configPath))) {
      throw new Error(`${configPath} already exists. Use --force to overwrite it.`);
    }

    await ensureGitRepository(cwd, "main");
    const discovered = await discoverTrackedFiles(cwd);
    const config = createDefaultConfig(cwd, discovered);
    config.current_context_name = (await getCurrentBranch(cwd)) ?? config.default_branch;
    await saveConfig(cwd, config);

    success(`Initialized context9 at ${configPath}`);
    info(`Tracked files: ${config.files.map((file) => file.path).join(", ")}`);
  });

program
  .command("current")
  .description("Show the active project and context")
  .action(async () => {
    const cwd = process.cwd();
    const config = await requireConfig(cwd);
    const credentials = await loadCredentials();
    const branch = await getCurrentBranch(cwd);
    const contextName = await resolveContextName(cwd, config);
    const configPath = getProjectConfigPath(cwd);

    console.log(`project: ${config.project_name}`);
    console.log(`project_id: ${config.project_id}`);
    console.log(`config: ${configPath}`);
    console.log(`branch: ${branch ?? "(no git branch yet)"}`);
    console.log(`context: ${contextName}`);
    console.log(`api_url: ${credentials.api_url ?? process.env.CONTEXT9_API_URL ?? DEFAULT_API_BASE_URL}`);
  });

program
  .command("push")
  .description("Encrypt and upload tracked secrets through the context9 API")
  .option("-c, --context <name>", "context name to upload into")
  .action(async (options: { context?: string }) => {
    const cwd = process.cwd();
    const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
    const contextName = await resolveContextName(cwd, config, options.context);
    const result = await pushFromWorkspace(cwd, config, credentials, masterKey, contextName);

    success(
      `Uploaded ${result.uploadedEntries} secret entr${result.uploadedEntries === 1 ? "y" : "ies"} from ${result.uploadedFiles} tracked file(s) into context "${contextName}".`,
    );
  });

program
  .command("pull")
  .description("Pull tracked secrets from the context9 API into the current workspace")
  .option("-c, --context <name>", "context name to materialize")
  .action(async (options: { context?: string }) => {
    const cwd = process.cwd();
    const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
    const contextName = await resolveContextName(cwd, config, options.context);
    const count = await pullIntoWorkspace(cwd, config, credentials, masterKey, contextName);

    success(`Materialized ${count} tracked file(s) for context "${contextName}".`);
  });

program
  .command("create")
  .description("Create a new git branch/context from the default branch")
  .argument("<branch_name>", "new context/branch name")
  .option("--lock", "lock the context after switching")
  .action(async (branchName: string, options: { lock?: boolean }) => {
    const cwd = process.cwd();
    const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
    await ensureGitRepository(cwd, config.default_branch);

    if (await branchExists(cwd, branchName)) {
      throw new Error(`Context "${branchName}" already exists.`);
    }

    const baseBranch = (await branchExists(cwd, config.default_branch))
      ? config.default_branch
      : (await getCurrentBranch(cwd)) ?? "HEAD";

    await checkoutBranch(cwd, branchName, {
      create: true,
      startPoint: baseBranch,
    });
    config.current_context_name = branchName;
    await saveConfig(cwd, config);

    await pushFromWorkspace(cwd, config, credentials, masterKey, branchName);
    await pullIntoWorkspace(cwd, config, credentials, masterKey, branchName);

    if (options.lock) {
      await maybeLockContext(cwd, config, credentials, branchName);
    }

    success(`Created and switched to context "${branchName}".`);
  });

async function switchContext(contextName: string, options: { lock?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
  await ensureGitRepository(cwd, config.default_branch);

  const exists = await branchExists(cwd, contextName);
  if (exists) {
    await checkoutBranch(cwd, contextName);
  } else {
    const baseBranch = (await branchExists(cwd, config.default_branch))
      ? config.default_branch
      : (await getCurrentBranch(cwd)) ?? "HEAD";
    await checkoutBranch(cwd, contextName, {
      create: true,
      startPoint: baseBranch,
    });
  }

  config.current_context_name = contextName;
  await saveConfig(cwd, config);

  await pullIntoWorkspace(cwd, config, credentials, masterKey, contextName);
  if (options.lock) {
    await maybeLockContext(cwd, config, credentials, contextName);
  }

  success(`Switched to context "${contextName}".`);
}

program
  .command("switch")
  .description("Switch to a context, materialize files, and optionally lock it")
  .argument("<context_name>", "context name")
  .option("--lock", "lock the context after switching")
  .action(switchContext);

const branch = program.command("branch").description("Inspect or switch contexts");

branch
  .command("checkout")
  .description("Checkout a branch/context and materialize secrets")
  .argument("<branch_name>", "branch/context name")
  .option("--lock", "lock the context after switching")
  .action(switchContext);

branch
  .command("list")
  .description("List remote contexts and lock state")
  .option("--available", "show only unlocked contexts")
  .option("--avaliable", "alias for --available")
  .action(async (options: { available?: boolean; avaliable?: boolean }) => {
    const cwd = process.cwd();
    const { config, credentials } = await resolveSecretMaterial(cwd);
    const session = await openRemoteSession(credentials);

    try {
      await syncProjectDefinitions(session, config, cwd);
      const contexts = await listRemoteContexts(session, config);
      const onlyAvailable = options.available || options.avaliable;
      const rows = onlyAvailable ? contexts.filter((context) => !context.lock_machine_id) : contexts;

      for (const context of rows) {
        console.log(
          `${context.name}\tbranch=${context.branch_name}\tlock=${formatLockOwner(context)}`,
        );
      }
    } finally {
      await session.close();
    }
  });

const remote = program.command("remote").description("Inspect encrypted remote state");

remote
  .command("tree")
  .description("Show the tracked remote file tree")
  .action(async () => {
    const cwd = process.cwd();
    const { config, credentials } = await resolveSecretMaterial(cwd);
    const session = await openRemoteSession(credentials);

    try {
      await syncProjectDefinitions(session, config, cwd);
      const rows = await listRemoteTree(session, config);
      for (const row of rows) {
        console.log(
          `${row.path}\tkind=${row.kind}\tshared=${row.shared_entries}\tcontext=${row.context_entries}\tcontexts=${row.context_count}`,
        );
      }
    } finally {
      await session.close();
    }
  });

remote
  .command("inspect")
  .description("Decrypt and print a tracked remote file")
  .argument("<relative_path>", "tracked relative path")
  .option("-c, --context <name>", "context name")
  .action(async (relativePath: string, options: { context?: string }) => {
    const cwd = process.cwd();
    const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
    const contextName = await resolveContextName(cwd, config, options.context);
    const session = await openRemoteSession(credentials);

    try {
      const content = await inspectRemoteFile(
        session,
        config,
        contextName,
        relativePath,
        masterKey,
      );
      process.stdout.write(content);
    } finally {
      await session.close();
    }
  });

program
  .command("manifest")
  .description("Print a redacted manifest for agents")
  .option("-c, --context <name>", "context name")
  .action(async (options: { context?: string }) => {
    const cwd = process.cwd();
    const config = await requireConfig(cwd);
    const contextName = await resolveContextName(cwd, config, options.context);
    const manifest = renderManifest(config, contextName);
    process.stdout.write(manifest);
    if (!manifest.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });

program
  .command("edit")
  .description("Edit a tracked dotenv file")
  .requiredOption("-f, --file <path>", "tracked dotenv path")
  .requiredOption("--env <pair...>", "KEY=VALUE pair(s)")
  .option("--push", "push the updated values after editing")
  .option("--branch-scoped", "mark new keys as context-specific")
  .option("--shared", "mark new keys as shared")
  .option("--description <text>", "description for newly added keys")
  .option("--provider <name>", "provider hint for newly added keys")
  .option("--reference <path>", "reference doc hint for newly added keys")
  .option("--prompt <text>", "acquire prompt hint for newly added keys")
  .action(
    async (options: {
      file: string;
      env: string[];
      push?: boolean;
      branchScoped?: boolean;
      shared?: boolean;
      description?: string;
      provider?: string;
      reference?: string;
      prompt?: string;
    }) => {
      const cwd = process.cwd();
      const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
      const branchScoped = options.shared ? false : options.branchScoped ? true : undefined;

      await writeDotenvValue(cwd, config, options.file, options.env, {
        branchScoped,
        description: options.description,
        provider: options.provider,
        reference: options.reference,
        acquirePrompt: options.prompt,
      });

      await saveConfig(cwd, config);
      success(`Updated ${options.file}.`);

      if (options.push) {
        const contextName = await resolveContextName(cwd, config);
        const result = await pushFromWorkspace(cwd, config, credentials, masterKey, contextName);
        success(
          `Uploaded ${result.uploadedEntries} secret entr${result.uploadedEntries === 1 ? "y" : "ies"} to context "${contextName}".`,
        );
      }
    },
  );

program
  .command("run")
  .description("Materialize the current context and run a command with dotenv values injected")
  .argument("<command...>", "command to execute")
  .allowUnknownOption(true)
  .action(async (commandParts: string[]) => {
    const cwd = process.cwd();
    const { config, credentials, masterKey } = await resolveSecretMaterial(cwd);
    const contextName = await resolveContextName(cwd, config);

    await pullIntoWorkspace(cwd, config, credentials, masterKey, contextName);
    const env = await buildRuntimeEnv(cwd, config);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(commandParts[0], commandParts.slice(1), {
        cwd,
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          ...env,
        },
      });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Command exited with code ${code ?? "unknown"}`));
      });
    });
  });

program.action(() => {
  return loadCredentials().then(async (credentials) => {
    const token = credentials.token ?? process.env.CONTEXT9_SERVICE_TOKEN;
    const apiUrl =
      credentials.api_url ??
      process.env.CONTEXT9_API_URL ??
      DEFAULT_API_BASE_URL;

    if (!token) {
      await loginWithDeviceCode(apiUrl);
      return;
    }

    warn("No command provided. Run `context9 --help`.");
  });
});

program.parseAsync(process.argv).catch((error) => {
  console.error(pc.red(`error: ${formatError(error)}`));
  process.exitCode = 1;
});
