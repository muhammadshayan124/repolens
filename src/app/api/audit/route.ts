import { NextRequest, NextResponse } from "next/server";
import { analyzeRepo } from "@/lib/analyze";
import { fetchRepoSnapshot, parseRepoUrl, RepoNotFoundError } from "@/lib/github";
import { isProviderId } from "@/lib/providers";

const MAX_KEY_LENGTH = 256;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const repoUrl = body?.repoUrl;
  const provider = body?.provider;
  const apiKey = body?.apiKey;

  if (typeof repoUrl !== "string" || repoUrl.trim() === "") {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }
  if (!isProviderId(provider)) {
    return NextResponse.json(
      { error: "provider must be one of: anthropic, openai, gemini" },
      { status: 400 }
    );
  }
  if (typeof apiKey !== "string" || apiKey.trim() === "" || apiKey.length > MAX_KEY_LENGTH) {
    return NextResponse.json({ error: "A valid API key is required" }, { status: 400 });
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse a GitHub owner/repo from that input" },
      { status: 400 }
    );
  }

  try {
    const snapshot = await fetchRepoSnapshot(parsed.owner, parsed.repo);
    // apiKey lives only in this local variable for the duration of this request -- it is
    // never logged, persisted, or echoed back in any response.
    const report = await analyzeRepo(snapshot, provider, apiKey);
    return NextResponse.json({
      repo: {
        owner: snapshot.owner,
        name: snapshot.repo,
        description: snapshot.description,
        stars: snapshot.stars,
      },
      report,
    });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    // Deliberately generic: an upstream SDK error could in principle echo request details.
    // Only a coarse status/category is surfaced, never the raw error object.
    const status = getStatusHint(err);
    return NextResponse.json(
      { error: "Failed to analyze the repository with the selected provider." },
      { status }
    );
  }
}

function getStatusHint(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number" && status >= 400 && status < 600) {
      return status;
    }
  }
  return 502;
}
