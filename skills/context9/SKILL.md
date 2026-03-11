---
name: context9
description: Use when a project stores branch-aware secrets with context9 and an agent needs to switch contexts, restore .env or private key files, inspect the redacted secret manifest, or follow provider-specific acquisition hints.
---

# Context9

Use this skill when a repository contains `context9.toml` and secret material is managed through `context9`.

## Core workflow

1. Read `context9.toml` and identify the relevant tracked file entry.
2. If the user wants the current worktree hydrated, run `context9 switch <context_name> --lock`.
3. If you only need the secret schema, run `context9 manifest`.
4. If a secret is missing, inspect the matching `provider`, `reference`, or `acquire_prompt` field from `context9.toml`.
5. Load the matching reference file from `references/providers/` only when needed.

## Commands

- `context9 current` shows the active project/context pair.
- `context9 branch list --available` shows contexts that are not locked.
- `context9 remote tree` shows which tracked files and scopes exist remotely.
- `context9 remote inspect <relative/path>` decrypts a tracked file for the current context.
- `context9 edit -f <relative/path> --env KEY=VALUE --push` updates a dotenv value and syncs it.

## Reference selection

- For `provider = "tidbcloud"` or `reference = "providers/tidbcloud.md"`, read [references/providers/tidbcloud.md](references/providers/tidbcloud.md).
- Prefer the smallest relevant reference file. Do not bulk-load all provider docs.
