import { useEffect, useState } from "react";
import { findLabelConflicts, normalizeLabelList } from "@issue-butler/core";
import type { ApiClient, GuildConfig } from "../api";

export function Settings({ api, guildId }: { api: ApiClient; guildId: string }) {
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [backlogInput, setBacklogInput] = useState("");
  const [inProgressInput, setInProgressInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getConfig(guildId)
      .then((loaded) => {
        setConfig(loaded);
        setBacklogInput(loaded.statusLabels.backlogLabels.join(", "));
        setInProgressInput(loaded.statusLabels.inProgressLabels.join(", "));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, guildId]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!config) return <p>No configuration yet. Run /setup in Discord first.</p>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const backlogLabels = normalizeLabelList(backlogInput);
    const inProgressLabels = normalizeLabelList(inProgressInput);
    const conflicts = findLabelConflicts(backlogLabels, inProgressLabels);
    if (conflicts.length > 0) {
      setError(`Labels cannot appear in both lists: ${conflicts.join(", ")}`);
      setSaving(false);
      return;
    }

    try {
      const updated = await api.updateConfig(guildId, {
        feedbackChannelId: config.feedbackChannelId,
        moderatorRoleId: config.moderatorRoleId,
        maxElaborationRounds: config.maxElaborationRounds,
        approvalEmoji: config.approvalEmoji,
        backlogLabels,
        inProgressLabels,
      });
      setConfig(updated);
      setBacklogInput(updated.statusLabels.backlogLabels.join(", "));
      setInProgressInput(updated.statusLabels.inProgressLabels.join(", "));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Feedback channel ID
        <input
          value={config.feedbackChannelId ?? ""}
          onChange={(e) => setConfig({ ...config, feedbackChannelId: e.target.value || null })}
          placeholder="Discord channel ID"
        />
      </label>
      <label>
        Moderator role ID
        <input
          value={config.moderatorRoleId ?? ""}
          onChange={(e) => setConfig({ ...config, moderatorRoleId: e.target.value || null })}
          placeholder="Discord role ID"
        />
      </label>
      <label>
        Max elaboration rounds
        <input
          type="number"
          min={0}
          max={10}
          value={config.maxElaborationRounds}
          onChange={(e) => setConfig({ ...config, maxElaborationRounds: Number(e.target.value) })}
        />
      </label>
      <label>
        Approval emoji
        <input
          value={config.approvalEmoji}
          onChange={(e) => setConfig({ ...config, approvalEmoji: e.target.value })}
          placeholder="👍"
        />
      </label>
      <label>
        Backlog labels
        <input
          value={backlogInput}
          onChange={(e) => setBacklogInput(e.target.value)}
          placeholder="backlog, planned, future-enhancement"
        />
      </label>
      <label>
        In-progress labels
        <input
          value={inProgressInput}
          onChange={(e) => setInProgressInput(e.target.value)}
          placeholder="in-progress, wip"
        />
      </label>
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {saved && <span className="success">Saved.</span>}
    </form>
  );
}
