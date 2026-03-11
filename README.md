# context9

`context9` makes `git worktree` usable for agent-based parallel development.

It restores branch runtime state that Git does not manage: `.env` files, secret files, shared values, and branch-scoped values.

## Quick start

```bash
context9 init
context9
context9 create feature/oauth-rework
context9 switch feature/oauth-rework --lock
context9 push
context9 pull
```

First run opens a browser with a device code. Sign in there, then return to the CLI.

## What it does

- stores tracked secret material in db9
- materializes `.env` files and non-git secret files into the current worktree
- separates shared values from branch-scoped values
- locks a context so multiple agents do not reuse the same branch runtime

## Local development

```bash
pnpm install
pnpm build
pnpm dev:web
pnpm --filter @context9/cli exec tsx src/cli.ts --help
```

## Backend setup

The CLI talks to a running `context9` backend.

Connection priority:

1. `DATABASE_URL` or `CONTEXT9_DATABASE_URL`
2. `DB9_API_KEY`
3. anonymous db9 bootstrap

Required env:

- `NEXTAUTH_SECRET`

Optional env:

- `NEXTAUTH_URL`
- `DATABASE_URL`
- `CONTEXT9_DATABASE_URL`
- `DB9_API_KEY`
- `DB9_API_URL`
- `RESEND_API_KEY`
- `CONTEXT9_EMAIL_FROM`
- `CONTEXT9_REMOTE_DATABASE_NAME`
- `CONTEXT9_SERVICE_TOKEN`
- `CONTEXT9_DB9_CREDENTIALS_PATH`

## Common commands

- `context9`
- `context9 auth login`
- `context9 auth login --token <token> --api-url <url>`
- `context9 auth logout`
- `context9 init`
- `context9 current`
- `context9 create <branch>`
- `context9 switch <context> --lock`
- `context9 push`
- `context9 pull`
- `context9 remote tree`
- `context9 remote inspect <relative/path>`
- `context9 manifest`
- `context9 edit -f .env --env KEY=VALUE --push`
- `context9 run <command...>`

## Repository layout

- `packages/cli`: CLI
- `apps/web`: backend
- `skills/context9`: agent skill and references
