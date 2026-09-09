import { describe, expect, it } from "vitest";
import { mapIssuesPayloadToEvent } from "../src/github/webhookEvents.js";

describe("mapIssuesPayloadToEvent", () => {
  it("maps a completed close", () => {
    expect(mapIssuesPayloadToEvent({ action: "closed", issue: { number: 1, state_reason: "completed" } })).toEqual({
      type: "closed",
      reason: "completed",
    });
  });

  it("maps a not-planned close", () => {
    expect(mapIssuesPayloadToEvent({ action: "closed", issue: { number: 1, state_reason: "not_planned" } })).toEqual({
      type: "closed",
      reason: "not_planned",
    });
  });

  it("treats a missing state_reason as completed", () => {
    expect(mapIssuesPayloadToEvent({ action: "closed", issue: { number: 1 } })).toEqual({
      type: "closed",
      reason: "completed",
    });
  });

  it("maps reopened", () => {
    expect(mapIssuesPayloadToEvent({ action: "reopened" })).toEqual({ type: "reopened" });
  });

  it("maps labeled with the label name", () => {
    expect(mapIssuesPayloadToEvent({ action: "labeled", label: { name: "backlog" } })).toEqual({
      type: "labeled",
      label: "backlog",
    });
  });

  it("maps unlabeled with the label name", () => {
    expect(mapIssuesPayloadToEvent({ action: "unlabeled", label: { name: "backlog" } })).toEqual({
      type: "unlabeled",
      label: "backlog",
    });
  });

  it("returns null for a labeled action missing the label field", () => {
    expect(mapIssuesPayloadToEvent({ action: "labeled" })).toBeNull();
  });

  it("returns null for actions this bot doesn't handle", () => {
    expect(mapIssuesPayloadToEvent({ action: "assigned" })).toBeNull();
    expect(mapIssuesPayloadToEvent({ action: "edited" })).toBeNull();
  });
});
