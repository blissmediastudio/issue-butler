import { describe, expect, it, vi } from "vitest";
import { formatCategory, formatRelativeTime, formatStatus, statusColor } from "../src/format.js";

describe("formatCategory", () => {
  it("labels every category distinctly", () => {
    const labels = (["bug", "feature", "help-desk", "general"] as const).map(formatCategory);
    expect(new Set(labels).size).toBe(4);
  });
});

describe("formatStatus / statusColor", () => {
  it("has a label and color for every status", () => {
    const statuses = ["open", "elaborating", "ready", "approved", "rejected"] as const;
    for (const status of statuses) {
      expect(formatStatus(status)).toBeTruthy();
      expect(statusColor(status)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("formatRelativeTime", () => {
  it("formats seconds-old timestamps as just now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:30Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("just now");
    vi.useRealTimers();
  });

  it("formats minutes and hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:30:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("30m ago");

    vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("3h ago");
    vi.useRealTimers();
  });

  it("formats days for older timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(formatRelativeTime("2026-01-01 12:00:00")).toBe("4d ago");
    vi.useRealTimers();
  });
});
