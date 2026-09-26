import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "@/test/db";
import { recordError } from "./errors";
import { COOLDOWN_MS, noteError, type AlertSender } from "./ops-alerts";

function sender() {
  const sent: string[] = [];
  const s: AlertSender = {
    email: async (to, subject) => { sent.push(`email ${to} ${subject}`); return true; },
    sms: async (to, text) => { sent.push(`sms ${to} ${text}`); return true; },
    webhook: async (url, text) => { sent.push(`hook ${url} ${text.split("\n")[0]}`); return true; },
  };
  return { s, sent };
}

describe("operator alerts", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb({ seed: false }); });
  afterAll(async () => { await t?.close(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  const report = (msg: string) => ({ message: msg, path: "/claims/x", method: "GET", routePath: "/claims/[id]" });

  it("sends nothing when no channel is set", async () => {
    const fp = await recordError(t.db, report("Quiet failure"));
    const { s, sent } = sender();
    expect(await noteError(t.db, { fingerprint: fp, message: "Quiet failure" }, { send: s })).toEqual({ sent: null, delivered: 0 });
    expect(sent).toEqual([]);
  });

  it("alerts once for a new error, then for a burst, each with a cooldown", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "ops@example.com");
    vi.stubEnv("OPS_ALERT_PHONES", "555-010-0000");
    vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    vi.stubEnv("OPS_ALERT_THRESHOLD", "5");
    const now = new Date("2026-09-26T12:00:00Z");
    const { s, sent } = sender();
    const fp = await recordError(t.db, report("Cannot read properties of undefined"), now);
    const first = await noteError(t.db, { fingerprint: fp, message: "Cannot read properties of undefined", routePath: "/claims/[id]" }, { now, send: s, origin: "https://app.test" });
    expect(first).toEqual({ sent: "new", delivered: 3 });
    expect(sent[0]).toBe("email ops@example.com CollaboratMD: new server error");
    expect(sent[1]).toMatch(/^sms \+15550100000 /);
    expect(sent[2]).toBe("hook https://hooks.example.com/x *CollaboratMD: new server error*");

    // The same error repeating is not new; a burst crosses the threshold once.
    const results = [];
    for (let i = 1; i <= 8; i++) {
      const at = new Date(now.getTime() + i * 1000);
      await recordError(t.db, report("Cannot read properties of undefined"), at);
      results.push((await noteError(t.db, { fingerprint: fp, message: "x" }, { now: at, send: s })).sent);
    }
    expect(results.filter((r) => r === "burst")).toHaveLength(1);
    expect(results.filter((r) => r === "new")).toHaveLength(0);

    // A second new error inside the cooldown stays quiet; after it, it alerts.
    const fp2 = await recordError(t.db, report("Another thing"), now);
    expect((await noteError(t.db, { fingerprint: fp2, message: "Another thing" }, { now: new Date(now.getTime() + 60_000), send: s })).sent).not.toBe("new");
    const fp3 = await recordError(t.db, report("Third thing"), now);
    expect((await noteError(t.db, { fingerprint: fp3, message: "Third thing" }, { now: new Date(now.getTime() + COOLDOWN_MS.new + 1000), send: s })).sent).toBe("new");
  });
});
