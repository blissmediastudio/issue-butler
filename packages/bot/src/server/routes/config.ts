import { Router } from "express";
import { z } from "zod";
import { findLabelConflicts } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { ensureGuildConfig, getGuildConfig, updateGuildConfig } from "../../db/guildConfig.js";

const updateSchema = z.object({
  feedbackChannelId: z.string().min(1).nullable().optional(),
  moderatorRoleId: z.string().min(1).nullable().optional(),
  maxElaborationRounds: z.number().int().min(0).max(10).optional(),
  approvalEmoji: z.string().min(1).optional(),
  backlogLabels: z.array(z.string().min(1)).optional(),
  inProgressLabels: z.array(z.string().min(1)).optional(),
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

    const current = ensureGuildConfig(db, req.params.guildId);
    // Same rule the /setup labels Discord command enforces — validated here too so the
    // dashboard can't put a guild into a state the Discord command would have rejected.
    const backlogLabels = parsed.data.backlogLabels ?? current.statusLabels.backlogLabels;
    const inProgressLabels = parsed.data.inProgressLabels ?? current.statusLabels.inProgressLabels;
    const conflicts = findLabelConflicts(backlogLabels, inProgressLabels);
    if (conflicts.length > 0) {
      res.status(400).json({ error: `Labels cannot appear in both lists: ${conflicts.join(", ")}` });
      return;
    }

    const config = updateGuildConfig(db, req.params.guildId, parsed.data);
    res.json(config);
  });

  return router;
}
