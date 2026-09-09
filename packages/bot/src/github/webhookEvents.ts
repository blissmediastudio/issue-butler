import type { GithubIssueEvent } from "@issue-butler/core";

/** The subset of GitHub's `issues` webhook payload this bot actually reads. */
export interface IssuesWebhookPayload {
  action: string;
  issue?: {
    number: number;
    state_reason?: "completed" | "not_planned" | null;
  };
  label?: {
    name: string;
  };
  installation?: {
    id: number;
  };
}

/** Maps a raw `issues` webhook payload to the pure event type `core` knows how to handle. */
export function mapIssuesPayloadToEvent(payload: IssuesWebhookPayload): GithubIssueEvent | null {
  switch (payload.action) {
    case "closed":
      return { type: "closed", reason: payload.issue?.state_reason === "not_planned" ? "not_planned" : "completed" };
    case "reopened":
      return { type: "reopened" };
    case "labeled":
      return payload.label ? { type: "labeled", label: payload.label.name } : null;
    case "unlabeled":
      return payload.label ? { type: "unlabeled", label: payload.label.name } : null;
    default:
      return null;
  }
}
