# context9

`context9` is a CLI for restoring runtime context in `git worktree`.

When multiple agents work on different branches, Git only separates code. It does not separate `.env` files, secret files, local runtime state, or branch-specific config. `context9` fills that gap.

## What problem it solves

Without `context9`, a new worktree usually means extra manual work:

- copy `.env` by hand
- recreate private key files
- remember which values are shared and which belong to one branch
- keep multiple agents from reusing the same branch runtime by accident

`context9` turns that into a repeatable flow:

1. sign in once from the CLI
2. create or switch a context
3. pull the right files into the current worktree
4. run and debug with the expected branch-specific values

## Core idea

`context9` stores tracked secret material remotely and materializes it into the current worktree on demand.

It treats config in two scopes:

- shared: values that can be reused across branches
- context-scoped: values that belong to one branch or one isolated runtime

## First-time setup

Start the backend:

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```

Then in your project root:

```bash
context9 init
context9
```

The first `context9` login uses device auth. It opens a browser to a page like:

```text
/login/device?code=XXXX-XXXX
```

By default, sign-in goes through GitHub. Email can still be used as a fallback if it is configured on the backend.

## Daily workflow

Create a new isolated branch context:

```bash
context9 create feature/oauth-rework
context9 switch feature/oauth-rework --lock
```

Push local secret material:

```bash
context9 push
```

Pull and materialize files for the current context:

```bash
context9 pull
```

Run a command with the current context loaded:

```bash
context9 run pnpm dev
```

## Common tasks

Show the current project and active context:

```bash
context9 current
```

Inspect what is stored remotely without showing raw values in normal workflow:

```bash
context9 remote tree
context9 remote inspect .env
context9 manifest
```

Edit one dotenv key locally and push it:

```bash
context9 edit -f .env --env DATABASE_URL=... --push
```

Log out or log in again:

```bash
context9 auth logout
context9 auth login
```

Manual token login is still supported:

```bash
context9 auth login --token <token> --api-url https://context9.vercel.app
```

## Backend notes

The CLI expects a running `context9` backend.

The backend reads local configuration from:

- [apps/web/.env.example](/Users/liangzhiyuan/Projects/context9/apps/web/.env.example)
- `apps/web/.env.local`

Typical local setup uses:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `CONTEXT9_EMAIL_FROM`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Repository layout

- `packages/cli`: the CLI
- `apps/web`: the backend
- `skills/context9`: agent references and prompts
