# TiDB Cloud

Use this reference when a `context9.toml` entry says the secret comes from `tidbcloud`.

## Typical use

- `DATABASE_URL` is branch-scoped.
- Each git/worktree context should point at a dedicated TiDB Cloud branch database.

## Agent workflow

1. Confirm the current git/context name.
2. In TiDB Cloud, create or select a database branch that matches the context.
3. Copy the branch connection string.
4. Update the local dotenv file with:

```bash
context9 edit -f .env --env DATABASE_URL='postgres://...'
```

5. Sync the change:

```bash
context9 push
```

## Notes

- Do not reuse a production write URL for disposable feature branches.
- Keep the value branch-scoped unless the project config explicitly marks it as shared.
