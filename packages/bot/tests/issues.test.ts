import { describe, expect, it, vi } from "vitest";
import { createIssue, type InstallationOctokit } from "../src/github/issues.js";

function fakeOctokit(request: ReturnType<typeof vi.fn>): InstallationOctokit {
  return { request } as unknown as InstallationOctokit;
}

describe("createIssue", () => {
  it("creates an issue with the draft's title, body, and labels", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      data: { html_url: "https://github.com/acme/repo/issues/7", number: 7 },
    });

    const result = await createIssue(fakeOctokit(request), "acme", "repo", {
      title: "Export button broken",
      body: "Steps...",
      category: "bug",
      labels: ["bug", "from-discord"],
    });

    expect(result).toEqual({ url: "https://github.com/acme/repo/issues/7", number: 7 });
    expect(request).toHaveBeenCalledWith("POST /repos/{owner}/{repo}/issues", {
      owner: "acme",
      repo: "repo",
      title: "Export button broken",
      body: "Steps...",
      labels: ["bug", "from-discord"],
    });
  });

  it("propagates errors from the GitHub API", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("403 Forbidden"));
    await expect(
      createIssue(fakeOctokit(request), "acme", "repo", { title: "x", body: "y", category: "bug", labels: [] }),
    ).rejects.toThrow("403 Forbidden");
  });
});
