import type { IssueDraft } from "@issue-butler/core";
import type { Octokit } from "@octokit/core";

/**
 * The type `App#getInstallationOctokit` resolves to when the App is constructed with the
 * default Octokit (no `.rest.*` convenience namespace — just `@octokit/core`'s `request()`,
 * which is enough for the handful of endpoints this bot calls and avoids an extra dependency).
 */
export type InstallationOctokit = Octokit;

export interface CreatedIssue {
  url: string;
  number: number;
}

export async function createIssue(
  octokit: InstallationOctokit,
  owner: string,
  repo: string,
  draft: IssueDraft,
): Promise<CreatedIssue> {
  const response = await octokit.request("POST /repos/{owner}/{repo}/issues", {
    owner,
    repo,
    title: draft.title,
    body: draft.body,
    labels: draft.labels,
  });
  return { url: response.data.html_url, number: response.data.number };
}
