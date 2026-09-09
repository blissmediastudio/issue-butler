import { Router } from "express";
import type { Database } from "../../db/index.js";
import { ensureGuildConfig, updateGuildConfig } from "../../db/guildConfig.js";
import { installUrl, listAccessibleRepos, type IssueButlerGithubApp } from "../../github/app.js";
import type { Config } from "../../config.js";
import type { Logger } from "../../logger.js";
import { signState, verifyState } from "../state.js";

export interface GithubConnectRouterOptions {
  db: Database;
  app: IssueButlerGithubApp;
  config: Config;
  logger: Logger;
}

/**
 * The two legs of the GitHub App install flow: `/start` sends the server owner to GitHub to
 * pick a repo, `/callback` is where GitHub's "Setup URL" sends them back afterward. Discord
 * never sees a GitHub token — `/setup connect-github` just links here.
 */
export function createGithubConnectRouter({ db, app, config, logger }: GithubConnectRouterOptions): Router {
  const router = Router();

  router.get("/connect/github/start", (req, res) => {
    const guildId = String(req.query.guildId ?? "");
    if (!guildId) {
      res.status(400).send("Missing guildId.");
      return;
    }
    ensureGuildConfig(db, guildId);
    const state = signState(guildId, config.SESSION_SECRET!);
    res.redirect(installUrl(config.GITHUB_APP_SLUG!, state));
  });

  router.get("/connect/github/callback", async (req, res) => {
    const installationId = Number(req.query.installation_id);
    const state = String(req.query.state ?? "");
    const guildId = verifyState(state, config.SESSION_SECRET!);

    if (!guildId || !Number.isInteger(installationId)) {
      res.status(400).send("This setup link is invalid or expired. Run /setup connect-github again in Discord.");
      return;
    }

    try {
      const repos = await listAccessibleRepos(app, installationId);
      const first = repos[0];
      if (!first) {
        res.status(400).send("The GitHub App was installed but wasn't granted access to any repository.");
        return;
      }

      const { owner, repo } = first;
      updateGuildConfig(db, guildId, {
        githubInstallationId: String(installationId),
        githubOwner: owner,
        githubRepo: repo,
      });

      const extra =
        repos.length > 1
          ? ` (${repos.length} repos are accessible; run /setup repo in Discord to pick a different one.)`
          : "";
      res.send(`GitHub connected: ${owner}/${repo}.${extra} You can close this tab.`);
    } catch (error) {
      logger.error("GitHub App install callback failed", { guildId, installationId, error: String(error) });
      res.status(500).send("Something went wrong finishing the GitHub connection. Please try again.");
    }
  });

  return router;
}
