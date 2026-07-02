import { NextRequest, NextResponse } from "next/server";
import { analyzeRepo } from "@/lib/analyze";
import { fetchRepoSnapshot, parseRepoUrl, RepoNotFoundError } from "@/lib/github";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const repoUrl = body?.repoUrl;

  if (typeof repoUrl !== "string" || repoUrl.trim() === "") {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
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
    const report = await analyzeRepo(snapshot);
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
