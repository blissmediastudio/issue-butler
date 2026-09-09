import { describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(function MockOctokit(this: { issues: { create: typeof createMock } }) {
    this.issues = { create: createMock };
  }),
}));

const { createGithubClient } = await import("../src/github/client.js");

describe("createGithubClient", () => {
  it("creates an issue with the draft's title, body, and labels", async () => {
    createMock.mockResolvedValueOnce({
      data: { html_url: "https://github.com/acme/repo/issues/7", number: 7 },
    });

    const client = createGithubClient({ token: "t", owner: "acme", repo: "repo" });
    const result = await client.createIssue({
      title: "Export button broken",
      body: "Steps...",
      category: "bug",
      labels: ["bug", "from-discord"],
    });

    expect(result).toEqual({ url: "https://github.com/acme/repo/issues/7", number: 7 });
    expect(createMock).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo",
      title: "Export button broken",
      body: "Steps...",
      labels: ["bug", "from-discord"],
    });
  });

  it("propagates errors from the GitHub API", async () => {
    createMock.mockRejectedValueOnce(new Error("403 Forbidden"));
    const client = createGithubClient({ token: "t", owner: "acme", repo: "repo" });
    await expect(
      client.createIssue({ title: "x", body: "y", category: "bug", labels: [] }),
    ).rejects.toThrow("403 Forbidden");
  });
});
