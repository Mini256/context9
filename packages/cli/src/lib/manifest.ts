import path from "node:path";
import type { Context9Config } from "./types.js";

export function renderManifest(config: Context9Config, contextName: string): string {
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
