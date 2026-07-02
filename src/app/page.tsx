"use client";

import { useState } from "react";
import type { AuditReport } from "@/lib/analyze";
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from "@/lib/providers/types";

interface RepoInfo {
  owner: string;
  name: string;
  description: string | null;
  stars: number;
}

interface AuditResponse {
  repo: RepoInfo;
  report: AuditReport;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  // Kept only in React state (memory) for this page load -- never written to
  // localStorage/sessionStorage/cookies, so it disappears on refresh or navigation.
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, provider, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center py-20 px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          RepoLens
        </h1>
        <p className="mt-2 text-center text-zinc-600 dark:text-zinc-400">
          Paste a public GitHub repo and get an AI-generated health audit — docs, CI,
          tests, licensing, and a check for accidentally committed secrets.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-3">
          <input
            type="text"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />

          <div className="flex gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              {PROVIDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {PROVIDER_LABELS[id]}
                </option>
              ))}
            </select>
            <input
              type="password"
              required
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Your ${PROVIDER_LABELS[provider]} API key`}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Your API key is sent directly to our server only to make this one request. It
            is never logged, stored, or persisted anywhere — not in a database, not in
            browser storage, not in server logs — and it&apos;s discarded the moment this
            request finishes. You pay for your own usage on your own account.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-5 py-2 font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {loading ? "Auditing…" : "Audit"}
          </button>
        </form>

        {error && (
          <p className="mt-6 w-full rounded-lg bg-red-50 px-4 py-3 text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-10 w-full">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                {result.repo.owner}/{result.repo.name}
              </h2>
              <span className={`text-2xl font-bold ${scoreColor(result.report.overallScore)}`}>
                {result.report.overallScore.toFixed(1)}/10
              </span>
            </div>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{result.report.headline}</p>

            {result.report.secretsFlag && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                ⚠️ Possible leaked secret detected in this repository.
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {result.report.categories.map((category) => (
                <div
                  key={category.name}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {category.name}
                    </span>
                    <span className={`font-semibold ${scoreColor(category.score)}`}>
                      {category.score}/10
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {category.summary}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-medium text-black dark:text-zinc-50">Recommendations</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-600 dark:text-zinc-400">
                {result.report.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
