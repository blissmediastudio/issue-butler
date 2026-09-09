import { describe, expect, it } from "vitest";
import { findLabelConflicts, normalizeLabelList } from "../src/statusLabels.js";

describe("normalizeLabelList", () => {
  it("splits on commas and trims whitespace", () => {
    expect(normalizeLabelList("backlog, planned , future")).toEqual(["backlog", "planned", "future"]);
  });

  it("drops empty entries from stray commas", () => {
    expect(normalizeLabelList("backlog,,planned,")).toEqual(["backlog", "planned"]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalizeLabelList("   ")).toEqual([]);
  });
});

describe("findLabelConflicts", () => {
  it("returns an empty array when the lists don't overlap", () => {
    expect(findLabelConflicts(["backlog"], ["in-progress"])).toEqual([]);
  });

  it("finds an exact-case overlap", () => {
    expect(findLabelConflicts(["backlog", "planned"], ["planned", "wip"])).toEqual(["planned"]);
  });

  it("finds overlaps case-insensitively", () => {
    expect(findLabelConflicts(["Backlog"], ["backlog"])).toEqual(["Backlog"]);
  });

  it("reports each conflicting label only once even with duplicates", () => {
    expect(findLabelConflicts(["wip", "wip"], ["wip"])).toEqual(["wip"]);
  });

  it("returns an empty array for two empty lists", () => {
    expect(findLabelConflicts([], [])).toEqual([]);
  });
});
