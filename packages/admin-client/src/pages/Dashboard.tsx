import { useEffect, useState } from "react";
import type { Category, ReportStatus } from "@issue-butler/core";
import type { ApiClient, Report } from "../api";
import { ReportCard } from "../components/ReportCard";

const STATUSES: ReportStatus[] = ["open", "elaborating", "ready", "approved", "rejected"];
const CATEGORIES: Category[] = ["bug", "feature", "help-desk", "general"];

export function Dashboard({ api, guildId }: { api: ApiClient; guildId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [category, setCategory] = useState<Category | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listReports(guildId, {
        status: status || undefined,
        category: category || undefined,
      })
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, guildId, status, category]);

  return (
    <div>
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && reports.length === 0 && <p>No reports match these filters.</p>}

      <div className="report-list">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} api={api} />
        ))}
      </div>
    </div>
  );
}
