import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { listLocations, saveLocation, setLocationActive } from "./locations";
import { createEncounterWithClaim } from "./encounters";
import { previewClaimEdi } from "./claims";

describe("locations and the service facility", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => { t = await testDb(); });
  afterAll(async () => { await t?.close(); });

  it("validates, saves and deactivates locations", async () => {
    await expect(saveLocation(t.db, t.practiceId, null, { name: "", address1: "1", city: "A", state: "TX", zip: "78701" })).rejects.toThrow(/name/);
    await expect(saveLocation(t.db, t.practiceId, null, { name: "X", npi: "1234567890", address1: "1", city: "A", state: "TX", zip: "78701" })).rejects.toThrow(/NPI/);
    await expect(saveLocation(t.db, t.practiceId, null, { name: "X", address1: "1", city: "A", state: "Texas", zip: "78701" })).rejects.toThrow(/state/);
    const l = await saveLocation(t.db, t.practiceId, null, { name: "Northside Clinic", npi: "1234567893", address1: "500 North Rd", city: "Austin", state: "tx", zip: "78758-1234" });
    expect(l).toMatchObject({ state: "TX", zip: "787581234", placeOfService: "11" });
    await setLocationActive(t.db, t.practiceId, l.id, false);
    expect(await listLocations(t.db, t.practiceId, { activeOnly: true })).toHaveLength(0);
    await setLocationActive(t.db, t.practiceId, l.id, true);
    await expect(setLocationActive(t.db, "00000000-0000-4000-8000-000000000000", l.id, false)).rejects.toThrow(/not found/);
  });

  it("names the location as the service facility (2310C) only when it is not the billing address", async () => {
    const [practice] = await t.db.select().from(schema.practices).where(eq(schema.practices.id, t.practiceId));
    const [ins] = await t.db.select().from(schema.patientInsurances).limit(1);
    const [provider] = await t.db.select().from(schema.providers).where(eq(schema.providers.practiceId, t.practiceId)).limit(1);
    const [away] = await listLocations(t.db, t.practiceId);
    const home = await saveLocation(t.db, t.practiceId, null, { name: "Main", address1: practice.address1, city: practice.city, state: practice.state, zip: practice.zip });

    const visit = async (locationId: string) => (await createEncounterWithClaim(t.db, t.practiceId, {
      patientId: ins.patientId, providerId: provider.id, dateOfService: new Date().toISOString().slice(0, 10), placeOfService: "11", locationId,
      diagnoses: ["E11.9"], lines: [{ cpt: "99213", modifiers: [], units: 1, chargeCents: 12000, dxPointers: [1] }],
    }, t.userId)).claim;

    const awayClaim = await visit(away.id);
    const awayEdi = (await previewClaimEdi(t.db, awayClaim.id)).edi;
    expect(awayEdi.replace(/\n/g, "")).toContain("NM1*77*2*Northside Clinic*****XX*1234567893~N3*500 North Rd~N4*Austin*TX*787581234~");
    // 2310C sits after the rendering provider (2310B) and before the service lines.
    expect(awayEdi.indexOf("NM1*82")).toBeLessThan(awayEdi.indexOf("NM1*77"));
    expect(awayEdi.indexOf("NM1*77")).toBeLessThan(awayEdi.indexOf("LX*1"));

    const homeClaim = await visit(home.id);
    expect((await previewClaimEdi(t.db, homeClaim.id)).edi).not.toContain("NM1*77");
  });
});
