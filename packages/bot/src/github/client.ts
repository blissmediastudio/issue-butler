import { Octokit } from "@octokit/rest";
import type { IssueDraft } from "@issue-butler/core";

export interface GithubClientOptions {
  token: string;
  owner: string;
  repo: string;
}

export interface CreatedIssue {
  url: string;
  number: number;
}

export interface GithubClient {
  createIssue(draft: IssueDraft): Promise<CreatedIssue>;
}

export function createGithubClient(options: GithubClientOptions): GithubClient {
  const octokit = new Octokit({ auth: options.token });

  return {
    async createIssue(draft) {
      const response = await octokit.issues.create({
        owner: options.owner,
        repo: options.repo,
        title: draft.title,
        body: draft.body,
        labels: draft.labels,
      });
      return { url: response.data.html_url, number: response.data.number };
    },
  };
}
