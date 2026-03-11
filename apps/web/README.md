# @context9/web

Next.js backend and landing page for `context9`.

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web
```

The app runs on `http://localhost:3000` by default.

## Environment

Start from `apps/web/.env.example`.

Typical local setup uses:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DB9_API_KEY`
- `RESEND_API_KEY`
- `CONTEXT9_EMAIL_FROM`
- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

`DATABASE_URL` is the primary database connection. `DB9_API_KEY` is optional when you are using a direct database URL.

## Build

```bash
pnpm --filter @context9/web build
```

## Deployment notes

- Set `NEXTAUTH_URL` to the deployed site URL.
- Keep all auth and database credentials in server-side environment variables.
- The CLI defaults to `https://context9.vercel.app`, so self-hosted deployments should use `context9 auth login --api-url ...`.
