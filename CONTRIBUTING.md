# Contributing to FTFC

Thanks for helping out! This is a small, live app that real players use every day,
so a few ground rules keep it safe. Please read this before your first pull request.

## Setup

See the [README](./README.md#getting-started) — install Node 20+, copy
`.env.example` to `.env.local` with the real Firebase values, and run `npm run dev`.

## The golden rule: never push straight to `main`

**`main` auto-deploys to production** (https://firsttouchfc.org). A bad commit on
`main` goes live to the whole club instantly. So:

1. Create a branch (or fork the repo):
   ```bash
   git checkout -b feature/short-description
   ```
2. Make your change, commit, and push your branch.
3. Open a **Pull Request** into `main`.
4. Wait for review + approval before merging.

Use clear branch names: `feature/...`, `fix/...`, `docs/...`.

## Before you open a PR

```bash
npm run build   # must succeed
npm run lint    # fix any new warnings you introduced
```

- Test your change locally against the running app.
- Keep PRs focused — one logical change per PR is easier to review.
- Write a short PR description: what changed and why.

## Working with the data (important)

There is **no separate dev database** — `npm run dev` reads and writes the **real
production Firestore**. So:

- Use obvious **test names** ("TEST — Alex") and remove them when done (Admin Panel →
  Remove, or Reset List).
- **Never** run bulk/load tests, scripts that mass-write, or anything that could
  corrupt the live list.
- Don't touch other players' real entries while testing.

## Secrets

- Real config lives in `.env.local`, which is **git-ignored** — never commit it.
- Don't paste API keys, tokens, or `.env` contents into code, issues, or PRs.
- If you think a secret was committed, tell the owner immediately.

## Code style

- Match the surrounding code: **functional React components + hooks**, plain
  JavaScript (no TypeScript), 2-space indent.
- Shared logic (schedule, list ordering, formatting) belongs in
  `src/utils/helpers.js`, not scattered in components.
- Keep it simple and readable — this app is maintained by volunteers.

## Questions

Open a GitHub Issue or ask the project owner. Welcome aboard! ⚽
