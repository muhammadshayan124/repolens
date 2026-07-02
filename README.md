# RepoLens

[![CI](https://github.com/muhammadshayan124/repolens/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammadshayan124/repolens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

An AI-powered health audit for public GitHub repositories. Paste a repo and get scored
feedback on documentation, licensing, CI/CD, testing, dependency hygiene, and a check for
accidentally committed secrets.

## How it works

1. Parses an `owner/repo` or full GitHub URL.
2. Pulls repo metadata, top-level file listing, README, `.gitignore`, CI workflow files,
   and a dependency manifest via the GitHub REST API (no auth required for public repos).
3. Sends the assembled snapshot to Claude with a fixed scoring rubric, validated against a
   strict schema (Zod) so the UI never has to guard against malformed model output.
4. Renders per-category scores, an overall score, and concrete recommendations.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Anthropic SDK · Zod · Vitest

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm run lint
npm run typecheck
npm test
```

## Project layout

```
src/
  app/
    page.tsx          landing page + report UI
    api/audit/route.ts  POST endpoint: fetch snapshot -> analyze -> return report
  lib/
    github.ts          GitHub API client + repo snapshot assembly
    analyze.ts          prompt construction, Claude call, schema-validated parsing
tests/                unit tests for snapshot assembly and analysis logic
```

## Design notes

- `GITHUB_TOKEN` is optional — public repo reads work fine unauthenticated (60 req/hr),
  the token just raises that ceiling (5000 req/hr) for heavier use. No scopes needed.
- The model is asked to return only JSON and the response is parsed through a Zod schema;
  a malformed or off-schema response fails loudly (502) rather than rendering garbage.
- `secretsFlag` is only set from concrete evidence (a suspicious filename actually present
  in the repo listing) — the prompt explicitly tells the model not to speculate.

## Deployment

Deployed on Vercel. Required environment variable: `ANTHROPIC_API_KEY`. Optional:
`GITHUB_TOKEN`, `ANTHROPIC_MODEL`.

## License

MIT — see [LICENSE](LICENSE).
