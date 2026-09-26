import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { expectedAllowed, contractTerms, ensureSchedule, checkClaimUnderpayment } from "./fees";
import { importContractCsv, parseModifierRules, saveContractRules } from "./contracts";

describe("contract reductions", () => {
  const rates = new Map([["29881", 60000], ["29880", 55000], ["20610", 8000], ["99213", 9000]]);

  it("pays the highest reducible procedure in full and the rest at the reduced percentage", () => {
    const lines = [{ cpt: "29880", units: 1 }, { cpt: "29881", units: 1 }, { cpt: "20610", units: 2 }, { cpt: "99213", units: 1 }];
    const terms = { rules: { mpprPercent: 50 }, mppr: new Set(["29880", "29881", "20610"]) };
    // 60000 + 55000/2 + 8000/2 + 8000/2 + 9000 (not reducible)
    expect(expectedAllowed(lines, rates, terms)).toEqual({ expectedCents: 60000 + 27500 + 4000 + 4000 + 9000, missing: [] });
    // Without terms, the flat sum.
    expect(expectedAllowed(lines, rates).expectedCents).toBe(60000 + 55000 + 16000 + 9000);
  });

  it("scales lines by modifier percentages before the reduction", () => {
    const terms = { rules: { mpprPercent: 50, modifiers: { "50": 150, "80": 16 } }, mppr: new Set(["29881", "29880"]) };
    expect(expectedAllowed([{ cpt: "29880", units: 1, modifiers: ["50"] }, { cpt: "29881", units: 1 }], rates, terms).expectedCents).toBe(82500 + 30000);
    expect(expectedAllowed([{ cpt: "29881", units: 1, modifiers: ["80"] }], rates, terms).expectedCents).toBe(9600);
    expect(expectedAllowed([{ cpt: "99999", units: 1 }], rates, terms).missing).toEqual(["99999"]);
  });

  it("parses modifier rules and refuses nonsense", () => {
    expect(parseModifierRules("50=150, 80:16; as=13.6%")).toEqual({ "50": 150, "80": 16, AS: 13.6 });
    expect(parseModifierRules("")).toEqual({});
    expect(() => parseModifierRules("bilateral")).toThrow(/modifier rule/);
    expect(() => parseModifierRules("50=900")).toThrow(/between 0 and 300/);
  });
});

describe("contract import", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb(); });
  afterAll(async () => { await t?.close(); });

  it("loads the payer's spreadsheet, marks reducible codes, and expects the reduced amount on a paid claim", async () => {
    const [claim] = await t.db.select().from(schema.claims).where(eq(schema.claims.practiceId, t.practiceId)).limit(1);
    const lines = await t.db.select().from(schema.charges).where(eq(schema.charges.encounterId, claim.encounterId));
    const std = await ensureSchedule(t.db, t.practiceId, null);
    await expect(importContractCsv(t.db, t.practiceId, std.id, "CPT,Allowed\n99213,90")).rejects.toThrow(/payer contracts/);
    const sched = await ensureSchedule(t.db, t.practiceId, claim.payerId);

    await expect(importContractCsv(t.db, t.practiceId, sched.id, "Name,Price\nx,1")).rejects.toThrow(/code column/);
    const csv = ["Procedure Code,Description,Allowed Amount,Mult Proc", ...lines.map((l) => `${l.cpt},"Visit, level 3","$1,000.00",Y`), "ABC,bad,10,N", "99999,,,"].join("\r\n");
    const r = await importContractCsv(t.db, t.practiceId, sched.id, csv, { replace: true });
    expect(r.imported).toBe(new Set(lines.map((l) => l.cpt)).size);
    expect(r.mppr).toBe(r.imported);
    expect(r.problems).toEqual(['Row ' + (lines.length + 2) + ': "ABC" is not a CPT or HCPCS code', `Row ${lines.length + 3}: 99999 has no allowed amount`]);

    await saveContractRules(t.db, t.practiceId, sched.id, { mpprPercent: "50", modifiers: "" });
    const terms = await contractTerms(t.db, t.practiceId, claim.payerId);
    expect(terms.rules).toEqual({ mpprPercent: 50 });
    const [row] = await t.db.select().from(schema.feeSchedules).where(and(eq(schema.feeSchedules.id, sched.id)));
    expect(row.rules).toEqual({ mpprPercent: 50 });

    await t.db.update(schema.claims).set({ status: "paid" }).where(eq(schema.claims.id, claim.id));
    const units = lines.reduce((a, l) => a + l.units, 0);
    const reduced = await checkClaimUnderpayment(t.db, claim.id);
    expect(reduced?.expectedCents).toBe(100000 + (units - 1) * 50000);

    // Clearing the terms stores nothing, so the fast scan handles the contract again, at the flat rate.
    await saveContractRules(t.db, t.practiceId, sched.id, { mpprPercent: "", modifiers: "" });
    expect((await contractTerms(t.db, t.practiceId, claim.payerId)).rules).toBeNull();
    expect((await checkClaimUnderpayment(t.db, claim.id))?.expectedCents).toBe(units * 100000);
  });
});
