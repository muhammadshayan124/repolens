import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchRepoSnapshot, parseRepoUrl, RepoNotFoundError } from "@/lib/github";

describe("parseRepoUrl", () => {
  it("parses owner/repo shorthand", () => {
    expect(parseRepoUrl("muhammadshayan124/sentinel")).toEqual({
      owner: "muhammadshayan124",
      repo: "sentinel",
    });
  });

  it("parses a full GitHub URL", () => {
    expect(parseRepoUrl("https://github.com/muhammadshayan124/sentinel")).toEqual({
      owner: "muhammadshayan124",
      repo: "sentinel",
    });
  });

  it("strips a trailing .git suffix", () => {
    expect(parseRepoUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(parseRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseRepoUrl("")).toBeNull();
  });

  it("rejects a bare word with no slash", () => {
    expect(parseRepoUrl("sentinel")).toBeNull();
  });
});

describe("fetchRepoSnapshot", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("GITHUB_TOKEN", "");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
    } as Response;
  }

  function b64(content: string) {
    return Buffer.from(content, "utf-8").toString("base64");
  }

  it("throws RepoNotFoundError when the repo metadata request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 404));

    await expect(fetchRepoSnapshot("owner", "missing")).rejects.toThrow(RepoNotFoundError);
  });

  it("assembles a snapshot from repo metadata and contents", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/repos/owner/repo")) {
        return Promise.resolve(
          jsonResponse({ description: "A test repo", stargazers_count: 5, default_branch: "main" })
        );
      }
      if (url.endsWith("/repos/owner/repo/contents")) {
        return Promise.resolve(
          jsonResponse([
            { name: "README.md", type: "file" },
            { name: "LICENSE", type: "file" },
            { name: ".gitignore", type: "file" },
            { name: "package.json", type: "file" },
            { name: "tests", type: "dir" },
          ])
        );
      }
      if (url.endsWith("/contents/.github/workflows")) {
        return Promise.resolve(jsonResponse([{ name: "ci.yml", type: "file" }]));
      }
      if (url.endsWith("/repos/owner/repo/readme")) {
        return Promise.resolve(jsonResponse({ content: b64("# Repo\nHello") }));
      }
      if (url.endsWith("/contents/.gitignore")) {
        return Promise.resolve(jsonResponse({ content: b64("node_modules\n.env\n") }));
      }
      if (url.endsWith("/contents/package.json")) {
        return Promise.resolve(jsonResponse({ content: b64('{"name":"repo"}') }));
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });

    const snapshot = await fetchRepoSnapshot("owner", "repo");

    expect(snapshot.description).toBe("A test repo");
    expect(snapshot.stars).toBe(5);
    expect(snapshot.hasReadme).toBe(true);
    expect(snapshot.readmeContent).toBe("# Repo\nHello");
    expect(snapshot.hasLicense).toBe(true);
    expect(snapshot.hasTestsDir).toBe(true);
    expect(snapshot.hasCiWorkflows).toBe(true);
    expect(snapshot.workflowFiles).toEqual(["ci.yml"]);
    expect(snapshot.gitignoreContent).toContain(".env");
    expect(snapshot.packageManifest).toEqual({ name: "package.json", content: '{"name":"repo"}' });
    expect(snapshot.suspiciousFiles).toEqual([]);
  });

  it("flags suspicious top-level filenames", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/repos/owner/leaky")) {
        return Promise.resolve(jsonResponse({ description: null, stargazers_count: 0 }));
      }
      if (url.endsWith("/repos/owner/leaky/contents")) {
        return Promise.resolve(jsonResponse([{ name: ".env", type: "file" }]));
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });

    const snapshot = await fetchRepoSnapshot("owner", "leaky");
    expect(snapshot.suspiciousFiles).toEqual([".env"]);
  });
});
