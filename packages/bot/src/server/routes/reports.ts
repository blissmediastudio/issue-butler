import { Router } from "express";
import type { Category, ReportStatus } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { getTranscript, listReports } from "../../db/reports.js";

const VALID_STATUSES: ReportStatus[] = ["open", "elaborating", "ready", "approved", "rejected"];
const VALID_CATEGORIES: Category[] = ["bug", "feature", "help-desk", "general"];

export function createReportsRouter(db: Database): Router {
  const router = Router();

  router.get("/guilds/:guildId/reports", (req, res) => {
    const { guildId } = req.params;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    if (status && !VALID_STATUSES.includes(status as ReportStatus)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }
    if (category && !VALID_CATEGORIES.includes(category as Category)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }

    const reports = listReports(db, {
      guildId,
      status: status as ReportStatus | undefined,
      category: category as Category | undefined,
    });
    res.json(reports);
  });

  router.get("/reports/:reportId/transcript", (req, res) => {
    const reportId = Number(req.params.reportId);
    if (!Number.isInteger(reportId)) {
      res.status(400).json({ error: "Invalid report id" });
      return;
    }
    res.json(getTranscript(db, reportId));
  });

  return router;
}
