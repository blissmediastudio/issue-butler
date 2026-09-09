import { describe, expect, it } from "vitest";
import { buildIssueDraft, draftTitle } from "../src/issueDraft.js";

describe("draftTitle", () => {
  it("uses the first line, collapsed to single spaces", () => {
    expect(draftTitle("The   export button\nis broken")).toBe("The export button");
  });

  it("truncates long titles with an ellipsis", () => {
    const long = "x".repeat(200);
    const title = draftTitle(long);
    expect(title.length).toBe(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back to a placeholder for empty text", () => {
    expect(draftTitle("   \n")).toBe("Untitled report");
  });
});

describe("buildIssueDraft", () => {
  it("includes the raw report and provenance footer", () => {
    const draft = buildIssueDraft({
      rawText: "The export button is broken.",
      category: "bug",
      authorTag: "alice#0001",
      sourceUrl: "https://discord.com/channels/1/2/3",
      transcript: [],
    });

    expect(draft.body).toContain("The export button is broken.");
    expect(draft.body).toContain("Reported by alice#0001 via Discord: https://discord.com/channels/1/2/3");
    expect(draft.labels).toEqual(["bug", "from-discord"]);
  });

  it("folds Q&A transcript into a clarifying details section", () => {
    const draft = buildIssueDraft({
      rawText: "The export button is broken.",
      category: "bug",
      authorTag: "alice#0001",
      sourceUrl: "https://discord.com/channels/1/2/3",
      transcript: [
        { role: "bot", content: "What browser?" },
        { role: "reporter", content: "Chrome." },
        { role: "bot", content: "Does it happen every time?" },
        { role: "reporter", content: "Yes." },
      ],
    });

    expect(draft.body).toContain("### Clarifying details");
    expect(draft.body).toContain("**Q:** What browser?");
    expect(draft.body).toContain("**A:** Chrome.");
  });

  it("omits the clarifying section when there is no transcript", () => {
    const draft = buildIssueDraft({
      rawText: "Just a note.",
      category: "general",
      authorTag: "bob#0002",
      sourceUrl: "https://discord.com/channels/1/2/4",
      transcript: [],
    });
    expect(draft.body).not.toContain("Clarifying details");
    expect(draft.labels).toEqual(["from-discord"]);
  });

  it("appends extra labels alongside the category label", () => {
    const draft = buildIssueDraft({
      rawText: "Feature idea.",
      category: "feature",
      authorTag: "carol#0003",
      sourceUrl: "https://discord.com/channels/1/2/5",
      transcript: [],
      extraLabels: ["needs-triage"],
    });
    expect(draft.labels).toEqual(["enhancement", "from-discord", "needs-triage"]);
  });
});
