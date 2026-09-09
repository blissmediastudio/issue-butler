import { describe, expect, it } from "vitest";
import {
  advanceConversation,
  createConversationState,
  nextFallbackQuestion,
  reporterSignalsDone,
} from "../src/conversation.js";

describe("reporterSignalsDone", () => {
  it.each(["done", "Done", "DONE.", "that's all", "thats all!", "nothing else", "that's it."])(
    "recognizes %s as a done signal",
    (phrase) => {
      expect(reporterSignalsDone(phrase)).toBe(true);
    },
  );

  it("does not treat ordinary answers as done signals", () => {
    expect(reporterSignalsDone("I'm done configuring the export settings when this happens")).toBe(false);
    expect(reporterSignalsDone("It happens every time I click save")).toBe(false);
  });
});

describe("createConversationState", () => {
  it("starts at round 0, incomplete", () => {
    const state = createConversationState(2);
    expect(state).toEqual({
      round: 0,
      maxRounds: 2,
      askedQuestions: [],
      complete: false,
      completionReason: "not-complete",
    });
  });
});

describe("advanceConversation", () => {
  it("completes immediately when the reporter says done", () => {
    const state = createConversationState(3);
    const next = advanceConversation(state, "done", "What happened next?");
    expect(next.complete).toBe(true);
    expect(next.completionReason).toBe("reporter-done");
    expect(next.round).toBe(0); // done short-circuits before incrementing
  });

  it("asks the next question and increments round when more remain", () => {
    const state = createConversationState(3);
    const next = advanceConversation(state, "It happens on Chrome only.", "Does it happen on other browsers?");
    expect(next.complete).toBe(false);
    expect(next.round).toBe(1);
    expect(next.askedQuestions).toEqual(["Does it happen on other browsers?"]);
  });

  it("completes with max-rounds when the round cap is hit", () => {
    let state = createConversationState(1);
    state = advanceConversation(state, "It happens on Chrome only.", "Does it happen elsewhere?");
    expect(state.complete).toBe(true);
    expect(state.completionReason).toBe("max-rounds");
  });

  it("completes with sufficient-detail when there is no next question", () => {
    const state = createConversationState(5);
    const next = advanceConversation(state, "Here are all the details you need.", null);
    expect(next.complete).toBe(true);
    expect(next.completionReason).toBe("sufficient-detail");
  });

  it("is a no-op once already complete", () => {
    let state = createConversationState(3);
    state = advanceConversation(state, "done", "irrelevant");
    const again = advanceConversation(state, "more info", "another question");
    expect(again).toBe(state);
  });
});

describe("nextFallbackQuestion", () => {
  it("returns the first unasked question for a category", () => {
    const question = nextFallbackQuestion("bug", []);
    expect(question).toBe("What steps reproduce this, from a fresh page load?");
  });

  it("skips already-asked questions", () => {
    const first = nextFallbackQuestion("bug", []);
    const second = nextFallbackQuestion("bug", [first!]);
    expect(second).not.toBe(first);
    expect(second).not.toBeNull();
  });

  it("returns null once the bank is exhausted", () => {
    const asked: string[] = [];
    let question = nextFallbackQuestion("feature", asked);
    while (question) {
      asked.push(question);
      question = nextFallbackQuestion("feature", asked);
    }
    expect(nextFallbackQuestion("feature", asked)).toBeNull();
  });

  it("has no fallback questions for general reports", () => {
    expect(nextFallbackQuestion("general", [])).toBeNull();
  });
});
