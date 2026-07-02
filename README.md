# RepoLens

[![CI](https://github.com/muhammadshayan124/repolens/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammadshayan124/repolens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

An AI-powered health audit for public GitHub repositories. Paste a repo, bring your own
Claude/GPT/Gemini API key, and get scored feedback on documentation, licensing, CI/CD,
testing, dependency hygiene, and a check for accidentally committed secrets.

## How it works

1. Parses an `owner/repo` or full GitHub URL.
2. Pulls repo metadata, top-level file listing, README, `.gitignore`, CI workflow files,
   and a dependency manifest via the GitHub REST API (no auth required for public repos).
3. Sends the assembled snapshot to the model you chose (Claude, GPT, or Gemini) with a
   fixed scoring rubric, validated against a strict schema (Zod) so the UI never has to
   guard against malformed model output.
4. Renders per-category scores, an overall score, and concrete recommendations.

## Bring your own key

RepoLens doesn't hold a server-side API key for any provider — you choose Claude, GPT, or
Gemini and paste your own key in the form. It's sent to the server only to make that one
request, is never logged or persisted (no database, no browser storage, no server logs),
and is discarded the moment the request finishes. You pay for your own usage on your own
account, and this app never sees traffic or cost from anyone else's key.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Anthropic/OpenAI/Google SDKs · Zod · Vitest

## Quickstart

```bash
npm install
cp .env.example .env.local   # optional: only GITHUB_TOKEN, for a higher rate limit
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick a provider, and paste your own
API key for that provider in the form.

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
    page.tsx          landing page + provider/key form + report UI
    api/audit/route.ts  POST endpoint: fetch snapshot -> analyze -> return report
  lib/
    github.ts          GitHub API client + repo snapshot assembly
    analyze.ts          prompt construction, provider dispatch, schema-validated parsing
    providers/          one module per provider (anthropic/openai/gemini), same interface
tests/                unit tests for snapshot assembly and analysis logic
```

## Design notes

- `GITHUB_TOKEN` is optional — public repo reads work fine unauthenticated (60 req/hr),
  the token just raises that ceiling (5000 req/hr) for heavier use. No scopes needed.
- Each provider module exports a single `generateText(prompt, apiKey)` function; `analyze.ts`
  only depends on that shared shape, so adding a fourth provider is a one-file addition.
- The model is asked to return only JSON and the response is parsed through a Zod schema;
  a malformed or off-schema response fails loudly (502) rather than rendering garbage.
- `secretsFlag` is only set from concrete evidence (a suspicious filename actually present
  in the repo listing) — the prompt explicitly tells the model not to speculate.
- API errors are sanitized before reaching the client — only a coarse HTTP status is
  surfaced, never the raw SDK error object, so a key can't leak back out through an error
  message.

## Deployment

Deployed on Vercel. No provider API key needed as an environment variable — those come
from the end user at request time. Optional: `GITHUB_TOKEN` for a higher GitHub rate limit.

## License

MIT — see [LICENSE](LICENSE).
