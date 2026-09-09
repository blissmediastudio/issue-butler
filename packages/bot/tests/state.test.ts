import { describe, expect, it } from "vitest";
import { signState, verifyState } from "../src/server/state.js";

const SECRET = "test-secret";

describe("signState / verifyState", () => {
  it("round-trips a guild id", () => {
    const state = signState("guild-123", SECRET);
    expect(verifyState(state, SECRET)).toBe("guild-123");
  });

  it("rejects a state signed with a different secret", () => {
    const state = signState("guild-123", SECRET);
    expect(verifyState(state, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered guild id", () => {
    const state = signState("guild-123", SECRET);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [, mac] = decoded.split(".");
    const tampered = Buffer.from(`guild-999.${mac}`, "utf8").toString("base64url");
    expect(verifyState(tampered, SECRET)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyState("not-valid-base64!!!", SECRET)).toBeNull();
    expect(verifyState("", SECRET)).toBeNull();
  });

  it("handles a guild id that itself contains a dot-like base64 artifact", () => {
    const state = signState("guild.with.dots", SECRET);
    expect(verifyState(state, SECRET)).toBe("guild.with.dots");
  });
});
