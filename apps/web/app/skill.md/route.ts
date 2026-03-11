const SKILL_TEXT = `---
name: context9
description: Use when a project stores branch-aware secrets with context9 and an agent needs to switch contexts, restore .env or private key files, inspect the redacted manifest, or follow provider-specific hints.
---

# Context9

Use this skill when a repository contains \`context9.toml\` and secret material is managed through \`context9\`.

## Core workflow

1. Read \`context9.toml\` and identify the tracked files.
2. If the worktree should be hydrated, run \`context9 switch <context_name> --lock\`.
3. If only the secret schema is needed, run \`context9 manifest\`.
4. If a secret is missing, inspect the matching \`provider\`, \`reference\`, or \`acquire_prompt\` field from \`context9.toml\`.
5. Load only the smallest relevant reference file.

## Commands

- \`context9\` starts device login when no token is stored.
- \`context9 current\` shows the active project and context.
- \`context9 remote tree\` shows tracked files and scopes stored remotely.
- \`context9 remote inspect <relative/path>\` decrypts a tracked file for the current context.
- \`context9 edit -f <relative/path> --env KEY=VALUE --push\` updates one dotenv value and syncs it.

## Behavior

- Prefer \`context9 switch <context_name> --lock\` after changing worktrees.
- Treat \`manifest\` as the safe overview and \`remote inspect\` as the value-level operation.
- Do not bulk-read every provider reference unless it is needed for the current secret.
`;

export async function GET() {
  return new Response(SKILL_TEXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
