import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs the guild id into the `state` param sent to GitHub's App install flow, so the
 * callback (which GitHub redirects to with only `installation_id` + `state`) can recover
 * which guild started the flow without trusting an unsigned client-supplied value.
 */
export function signState(guildId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(guildId).digest("hex");
  return Buffer.from(`${guildId}.${mac}`, "utf8").toString("base64url");
}

/** Returns the guild id if `state` is well-formed and its signature matches, else null. */
export function verifyState(state: string, secret: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.lastIndexOf(".");
  if (separatorIndex <= 0) return null;
  const guildId = decoded.slice(0, separatorIndex);
  const mac = decoded.slice(separatorIndex + 1);

  const expected = createHmac("sha256", secret).update(guildId).digest("hex");
  const macBuffer = Buffer.from(mac, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (macBuffer.length !== expectedBuffer.length || !timingSafeEqual(macBuffer, expectedBuffer)) {
    return null;
  }
  return guildId;
}
