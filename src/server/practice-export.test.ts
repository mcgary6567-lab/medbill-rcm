import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { exportPlan, practiceExport } from "./practice-export";

describe("full practice export", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb(); });
  afterAll(async () => { await t?.close(); });

  it("finds practice tables, including children reached through a parent, and drops credentials", async () => {
    const plan = await exportPlan(t.db);
    const names = plan.sources.map((s) => s.table);
    expect(names).toEqual(expect.arrayContaining(["practices", "patients", "claims", "ledger_entries", "users"]));
    expect(names).not.toContain("auth_throttle");
    expect(plan.sources.some((s) => typeof s.filter === "object")).toBe(true);
    expect(plan.columns.users.keep).not.toContain("password_hash");
    expect(plan.columns.users.keep).not.toContain("mfa_secret");
    expect(plan.columns.users.dropped).toContain("password_hash");
  });

  it("writes a zip with only this practice's rows, the attachments, and a readme", async () => {
    const [other] = await t.db.insert(schema.practices).values({ name: "Elsewhere", taxId: "22-2222222", npi: "2222222223", address1: "2 Elm", city: "Austin", state: "TX", zip: "78701" }).returning();
    await t.db.insert(schema.patients).values({ practiceId: other.id, mrn: "X-1", firstName: "Not", lastName: "Mine", dob: "1970-01-01", sex: "F" });
    const [claim] = await t.db.select().from(schema.claims).where(eq(schema.claims.practiceId, t.practiceId)).limit(1);
    await t.db.insert(schema.claimAttachments).values({ practiceId: t.practiceId, claimId: claim.id, reportType: "OZ", transmission: "EL", controlNumber: "ATT1", filename: "op note.pdf", contentType: "application/pdf", sizeBytes: 5, sha256: "x", dataBase64: Buffer.from("hello").toString("base64") });

    const chunks: Uint8Array[] = [];
    for await (const c of practiceExport(t.db, t.practiceId)) chunks.push(c);
    const files = unzipSync(new Uint8Array(Buffer.concat(chunks)));

    const patients = strFromU8(files["tables/patients.csv"]).trim().split("\r\n");
    const mine = await t.db.select().from(schema.patients).where(eq(schema.patients.practiceId, t.practiceId));
    expect(patients.length - 1).toBe(mine.length);
    expect(patients.join("\n")).not.toContain("Mine");
    expect(strFromU8(files["tables/practices.csv"]).trim().split("\r\n")).toHaveLength(2);
    expect(strFromU8(files["tables/users.csv"])).not.toMatch(/password_hash|\$2[aby]\$/);
    const att = Object.keys(files).find((k) => k.startsWith("attachments/"))!;
    expect(att).toMatch(/op_note\.pdf$/);
    expect(strFromU8(files[att])).toBe("hello");
    const readme = strFromU8(files["README.txt"]);
    expect(readme).toContain(`patients: ${mine.length} rows`);
    expect(readme).toContain("attachments: 1 files");
    expect(readme).toMatch(/users: .*password_hash/);
  });
});
