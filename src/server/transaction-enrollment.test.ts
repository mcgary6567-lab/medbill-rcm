import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { eraGaps, saveTransactionEnrollments, transactionGrid } from "./transaction-enrollment";

describe("clearinghouse enrollment", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb(); });
  afterAll(async () => { await t?.close(); });

  it("stamps dates as statuses change and lists billed payers without ERA enrollment", async () => {
    const [claim] = await t.db.select().from(schema.claims).where(and(eq(schema.claims.practiceId, t.practiceId))).limit(1);
    await t.db.update(schema.claims).set({ submittedAt: new Date(), createdAt: new Date() }).where(eq(schema.claims.id, claim.id));
    const before = await eraGaps(t.db, t.practiceId);
    expect(before.some((g) => g.payerId === claim.payerId)).toBe(true);

    expect(await saveTransactionEnrollments(t.db, t.practiceId, claim.payerId, { era: "submitted", eft: "not_started" }, t.userId, "2026-09-01")).toEqual(["era:submitted"]);
    let row = (await transactionGrid(t.db, t.practiceId)).get(claim.payerId, "era");
    expect(row).toMatchObject({ status: "submitted", submittedOn: "2026-09-01", approvedOn: null });

    await saveTransactionEnrollments(t.db, t.practiceId, claim.payerId, { era: "approved" }, t.userId, "2026-09-20");
    row = (await transactionGrid(t.db, t.practiceId)).get(claim.payerId, "era");
    expect(row).toMatchObject({ status: "approved", submittedOn: "2026-09-01", approvedOn: "2026-09-20" });
    expect((await eraGaps(t.db, t.practiceId)).some((g) => g.payerId === claim.payerId)).toBe(false);

    await expect(saveTransactionEnrollments(t.db, t.practiceId, claim.payerId, { era: "bogus" })).rejects.toThrow(/Unknown status/);
    await expect(saveTransactionEnrollments(t.db, t.practiceId, "00000000-0000-4000-8000-000000000000", { era: "approved" })).rejects.toThrow();
  });
});
