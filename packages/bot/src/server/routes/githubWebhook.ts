import { Router, raw } from "express";
import type { IssueButlerGithubApp } from "../../github/app.js";
import type { Logger } from "../../logger.js";

/**
 * Receives GitHub's webhook POSTs and hands them to `app.webhooks`, which verifies the
 * `x-hub-signature-256` HMAC before any handler registered with `app.webhooks.on(...)` runs.
 * Needs the RAW request body for signature verification, so this route must NOT sit behind
 * the global `express.json()` parser — it has its own `raw()` middleware instead.
 */
export function createGithubWebhookRouter(app: IssueButlerGithubApp, logger: Logger): Router {
  const router = Router();

  router.post("/webhooks/github", raw({ type: "application/json" }), async (req, res) => {
    const id = req.header("x-github-delivery");
    const name = req.header("x-github-event");
    const signature = req.header("x-hub-signature-256");

    if (!id || !name || !signature) {
      res.status(400).end();
      return;
    }

    try {
      await app.webhooks.verifyAndReceive({
        id,
        name: name as Parameters<typeof app.webhooks.verifyAndReceive>[0]["name"],
        payload: req.body.toString("utf8"),
        signature,
      });
      res.status(200).end();
    } catch (error) {
      logger.warn("Rejected GitHub webhook delivery", { id, name, error: String(error) });
      res.status(400).end();
    }
  });

  return router;
}
