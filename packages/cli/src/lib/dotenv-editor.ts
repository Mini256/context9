import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import type { Context9Config, KeyRule } from "./types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeDotenvValue(
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
