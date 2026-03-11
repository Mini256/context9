# context9

`context9` is a monorepo with:

- a Node.js CLI for agents that need branch-aware secret material in Git worktrees
- a Next.js API server that accesses `db9` from the server side only through Prisma

## Workspace layout

- `apps/web`: Next.js App Router server exposing authenticated API routes backed by Prisma and db9.
- `packages/cli`: Commander-based CLI implementation.
- `skills/context9`: Agent skill and provider references.

## Next.js API

The Next.js app is the server-side entrypoint for db9 access. It uses Prisma 7 with `@prisma/adapter-pg` to connect to db9 over PostgreSQL. Browser clients should only call Next.js route handlers; they should never talk to db9 directly.

Current routes:

- `GET /api/health`
- `GET /api/auth/access`
- `PUT /api/projects/:projectId`
- `GET /api/projects/:projectId/contexts`
- `POST /api/projects/:projectId/contexts`
- `POST /api/projects/:projectId/contexts/:contextName/lock`
- `GET|PUT /api/projects/:projectId/contexts/:contextName/secrets`
- `GET /api/projects/:projectId/remote/tree`
- `GET /api/projects/:projectId/remote/inspect`
- `GET|POST /api/auth/[...nextauth]`

Authentication:

- `NextAuth` session cookies for browser/admin access
- `Authorization: Bearer <CONTEXT9_SERVICE_TOKEN>` or `x-context9-api-key` for CLI/service access

Required server env:

- `NEXTAUTH_SECRET`

Optional server env:

- `DATABASE_URL`
- `CONTEXT9_DATABASE_URL`
- `DB9_API_KEY`
- `DB9_API_URL`
- `CONTEXT9_REMOTE_DATABASE_NAME`
- `CONTEXT9_SERVICE_TOKEN`
- `CONTEXT9_ADMIN_EMAIL`
- `CONTEXT9_ADMIN_PASSWORD`
- `CONTEXT9_DB9_CREDENTIALS_PATH`

Connection priority is:

1. `DATABASE_URL` or `CONTEXT9_DATABASE_URL`
2. `DB9_API_KEY`
3. anonymous bootstrap

Per the official [db9 skill](https://db9.ai/skill.md), db9 can bootstrap an anonymous account on first create when no credentials are present. For production or long-running automation, prefer `DATABASE_URL` or an explicit API key.

## Current MVP commands

- `context9 auth login`
- `context9 auth login --token <token> --api-url <url>`
- `context9 auth logout`
- `context9 init`
- `context9 current`
- `context9 push`
- `context9 pull`
- `context9 create <branch>`
- `context9 switch <context> --lock`
- `context9 branch checkout <branch> --lock`
- `context9 branch list --available`
- `context9 remote tree`
- `context9 remote inspect <relative/path>`
- `context9 manifest`
- `context9 edit -f .env --env KEY=VALUE --push`
- `context9 run <command...>`

## Build

```bash
pnpm install
pnpm build
```

## Dev

```bash
pnpm --filter @context9/cli exec tsx src/cli.ts --help
pnpm dev:web
```

## CLI auth

The CLI no longer talks to db9 directly. It calls the Next.js API and stores:

- `token`: the context9 API token
- `api_url`: the Next.js API base URL
- `master_key`: the local encryption key used before upload

Example:

```bash
context9 auth login --token "$CONTEXT9_SERVICE_TOKEN" --api-url http://localhost:3000
```
