import { App } from "@octokit/app";
import type { Config } from "../config.js";

export type IssueButlerGithubApp = App;

export function createGithubApp(config: Config): IssueButlerGithubApp | null {
  if (!config.githubAppEnabled) return null;

  return new App({
    appId: config.GITHUB_APP_ID!,
    privateKey: config.GITHUB_APP_PRIVATE_KEY!,
    webhooks: { secret: config.GITHUB_WEBHOOK_SECRET! },
  });
}

export function installUrl(appSlug: string, state: string): string {
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;
}

export interface AccessibleRepo {
  owner: string;
  repo: string;
}

/** The repos an installation was granted access to, used to auto-select one after install. */
export async function listAccessibleRepos(app: IssueButlerGithubApp, installationId: number): Promise<AccessibleRepo[]> {
  const octokit = await app.getInstallationOctokit(installationId);
  const response = await octokit.request("GET /installation/repositories");
  return response.data.repositories.map((repository) => ({
    owner: repository.owner.login,
    repo: repository.name,
  }));
}
