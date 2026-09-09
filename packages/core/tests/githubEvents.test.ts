import { describe, expect, it } from "vitest";
import { messageForGithubEvent } from "../src/githubEvents.js";
import { DEFAULT_STATUS_LABELS } from "../src/types.js";

describe("messageForGithubEvent", () => {
  it("announces a fix for bug reports closed as completed", () => {
    const msg = messageForGithubEvent({ type: "closed", reason: "completed" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("🎉 Fixed!");
  });

  it("announces implementation for feature reports closed as completed", () => {
    const msg = messageForGithubEvent({ type: "closed", reason: "completed" }, "feature", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("🎉 Implemented!");
  });

  it("treats a missing close reason the same as completed", () => {
    const msg = messageForGithubEvent({ type: "closed", reason: null }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("🎉 Fixed!");
  });

  it("announces a decline for issues closed as not planned, regardless of category", () => {
    const bug = messageForGithubEvent({ type: "closed", reason: "not_planned" }, "bug", DEFAULT_STATUS_LABELS);
    const feature = messageForGithubEvent({ type: "closed", reason: "not_planned" }, "feature", DEFAULT_STATUS_LABELS);
    expect(bug).toBe("This won't be addressed right now.");
    expect(feature).toBe("This won't be addressed right now.");
  });

  it("announces reopening", () => {
    const msg = messageForGithubEvent({ type: "reopened" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("Reopened — back under consideration.");
  });

  it("recognizes a configured backlog label case-insensitively", () => {
    const msg = messageForGithubEvent({ type: "labeled", label: "Backlog" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("📋 Added to the backlog for a future release.");
  });

  it("recognizes a configured in-progress label", () => {
    const msg = messageForGithubEvent({ type: "labeled", label: "wip" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBe("🔧 Work has started on this.");
  });

  it("respects custom label configuration instead of the defaults", () => {
    const config = { backlogLabels: ["someday"], inProgressLabels: ["doing"] };
    expect(messageForGithubEvent({ type: "labeled", label: "backlog" }, "bug", config)).toBeNull();
    expect(messageForGithubEvent({ type: "labeled", label: "someday" }, "bug", config)).toBe(
      "📋 Added to the backlog for a future release.",
    );
  });

  it("returns null for labels that aren't configured as meaningful", () => {
    const msg = messageForGithubEvent({ type: "labeled", label: "good first issue" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBeNull();
  });

  it("returns null for unlabeled events (not surfaced)", () => {
    const msg = messageForGithubEvent({ type: "unlabeled", label: "backlog" }, "bug", DEFAULT_STATUS_LABELS);
    expect(msg).toBeNull();
  });
});
