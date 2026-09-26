import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { testDb } from "@/test/db";
import { LIMITS, hit, pruneThrottle, throttleKey } from "./throttle";

describe("attempt budgets per address", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb(); });
  afterAll(async () => { await t?.close(); });

  it("allows the budget, refuses after it, and starts over when the window ends", async () => {
    const start = new Date("2026-09-26T10:00:00Z");
    for (let i = 0; i < LIMITS.reset.max; i++) expect((await hit(t.db, "reset", "203.0.113.9", start)).ok).toBe(true);
    const over = await hit(t.db, "reset", "203.0.113.9", new Date(start.getTime() + 60_000));
    expect(over).toEqual({ ok: false, retryAfterSec: 59 * 60 });
    // Another address and another kind have their own budgets.
    expect((await hit(t.db, "reset", "203.0.113.10", start)).ok).toBe(true);
    expect((await hit(t.db, "login", "203.0.113.9", start)).ok).toBe(true);
    const later = new Date(start.getTime() + LIMITS.reset.windowSec * 1000 + 1);
    expect((await hit(t.db, "reset", "203.0.113.9", later)).ok).toBe(true);
  });

  it("stores only a hash of the address and prunes old windows", async () => {
    expect(throttleKey("login", "203.0.113.9")).not.toContain("203.0.113");
    const { rows } = await t.db.execute(sql`SELECT key FROM auth_throttle`);
    expect(rows.every((r) => !String((r as { key: string }).key).includes("203."))).toBe(true);
    expect(await pruneThrottle(t.db, new Date("2026-09-28T00:00:00Z"))).toBeGreaterThan(0);
  });
});
