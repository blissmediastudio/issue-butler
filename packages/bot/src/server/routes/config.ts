import { Router } from "express";
import { z } from "zod";
import type { Database } from "../../db/index.js";
import { ensureGuildConfig, getGuildConfig, updateGuildConfig } from "../../db/guildConfig.js";

const updateSchema = z.object({
  feedbackChannelId: z.string().min(1).nullable().optional(),
  moderatorRoleId: z.string().min(1).nullable().optional(),
  maxElaborationRounds: z.number().int().min(0).max(10).optional(),
});

export function createConfigRouter(db: Database): Router {
  const router = Router();

  router.get("/guilds/:guildId/config", (req, res) => {
    const config = getGuildConfig(db, req.params.guildId);
    if (!config) {
      res.status(404).json({ error: "Guild not configured yet" });
      return;
    }
    res.json(config);
  });

  router.put("/guilds/:guildId/config", (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    ensureGuildConfig(db, req.params.guildId);
    const config = updateGuildConfig(db, req.params.guildId, parsed.data);
    res.json(config);
  });

  return router;
}
