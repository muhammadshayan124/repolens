export interface RepoSnapshot {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  defaultBranch: string;
  topLevelFiles: string[];
  hasReadme: boolean;
  readmeContent: string | null;
  hasLicense: boolean;
  hasCiWorkflows: boolean;
  workflowFiles: string[];
  hasTestsDir: boolean;
  gitignoreContent: string | null;
  packageManifest: { name: string; content: string } | null;
  suspiciousFiles: string[];
}

interface GitHubContentEntry {
  name: string;
  type: string;
}

const SUSPICIOUS_FILENAMES = [
  ".env",
  ".env.local",
  ".env.production",
  "credentials.json",
  "secrets.json",
  "id_rsa",
  "service-account.json",
];

const TEST_DIR_NAMES = ["tests", "test", "__tests__", "spec"];
const MANIFEST_CANDIDATES = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
];

export class RepoNotFoundError extends Error {}

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const shorthandMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shorthandMatch && !trimmed.includes("://")) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2].replace(/\.git$/, "") };
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function ghFetch(path: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, { headers: githubHeaders(), cache: "no-store" });
}

async function fetchDecodedFile(path: string): Promise<string | null> {
  const res = await ghFetch(path);
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data.content !== "string") return null;
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function fetchRepoSnapshot(owner: string, repo: string): Promise<RepoSnapshot> {
  const metaRes = await ghFetch(`/repos/${owner}/${repo}`);
  if (!metaRes.ok) {
    throw new RepoNotFoundError(`Repository not found or not accessible (HTTP ${metaRes.status})`);
  }
  const meta = await metaRes.json();

  const contentsRes = await ghFetch(`/repos/${owner}/${repo}/contents`);
  const contents: GitHubContentEntry[] = contentsRes.ok ? await contentsRes.json() : [];
  const names = contents.map((c) => c.name);
  const lowerNames = names.map((n) => n.toLowerCase());

  const hasReadme = lowerNames.some((n) => n.startsWith("readme"));
  const hasLicense = lowerNames.some((n) => n.startsWith("license") || n.startsWith("licence"));
  const hasTestsDir = lowerNames.some((n) => TEST_DIR_NAMES.includes(n));
  const suspiciousFiles = names.filter((n) =>
    SUSPICIOUS_FILENAMES.includes(n.toLowerCase())
  );

  let workflowFiles: string[] = [];
  const workflowsRes = await ghFetch(`/repos/${owner}/${repo}/contents/.github/workflows`);
  if (workflowsRes.ok) {
    const workflows = await workflowsRes.json();
    if (Array.isArray(workflows)) {
      workflowFiles = workflows.map((w: GitHubContentEntry) => w.name);
    }
  }

  const readmeContent = hasReadme ? await fetchDecodedFile(`/repos/${owner}/${repo}/readme`) : null;
  const gitignoreContent = names.includes(".gitignore")
    ? await fetchDecodedFile(`/repos/${owner}/${repo}/contents/.gitignore`)
    : null;

  let packageManifest: { name: string; content: string } | null = null;
  for (const candidate of MANIFEST_CANDIDATES) {
    if (names.includes(candidate)) {
      const content = await fetchDecodedFile(`/repos/${owner}/${repo}/contents/${candidate}`);
      if (content !== null) packageManifest = { name: candidate, content };
      break;
    }
  }

  return {
    owner,
    repo,
    description: meta.description ?? null,
    stars: meta.stargazers_count ?? 0,
    defaultBranch: meta.default_branch ?? "main",
    topLevelFiles: names,
    hasReadme,
    readmeContent,
    hasLicense,
    hasCiWorkflows: workflowFiles.length > 0,
    workflowFiles,
    hasTestsDir,
    gitignoreContent,
    packageManifest,
    suspiciousFiles,
  };
}
