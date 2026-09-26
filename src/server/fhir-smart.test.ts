import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLocalJWKSet, jwtVerify } from "jose";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { getFhir, saveFhir, syncFhir, testFhir } from "./fhir";
import { clearSmartTokens, generateSmartKey, jwksFor, saveSmartSettings, type SmartHttp } from "./fhir-smart";

const BASE = "https://ehr.test/fhir/r4";
const TOKEN_URL = "https://ehr.test/oauth2/token";

describe("SMART backend services", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    t = await testDb({ seed: false });
    const [p] = await t.db.insert(schema.practices).values({ name: "Smart Clinic", taxId: "11-1111111", npi: "1234567893", address1: "1 Main", city: "Austin", state: "TX", zip: "78701" }).returning();
    t.practiceId = p.id;
  });
  afterAll(async () => { await t?.close(); });
  beforeEach(() => clearSmartTokens());

  it("needs a connection, a client ID and a key", async () => {
    await expect(generateSmartKey(t.db, t.practiceId)).rejects.toThrow(/base URL/);
    await saveFhir(t.db, t.practiceId, { baseUrl: BASE });
    await expect(saveSmartSettings(t.db, t.practiceId, { mode: "smart" })).rejects.toThrow(/client ID/);
    await expect(saveSmartSettings(t.db, t.practiceId, { mode: "smart", clientId: "c", tokenUrl: "http://x" })).rejects.toThrow(/https/);
  });

  it("signs an RS384 assertion the EHR can verify with our JWKS, gets a token, and reuses it", async () => {
    const jwk = await generateSmartKey(t.db, t.practiceId);
    expect(jwk).toMatchObject({ kty: "RSA", alg: "RS384", use: "sig" });
    expect(jwk).not.toHaveProperty("d");
    const conn = await getFhir(t.db, t.practiceId);
    expect(conn?.privateKeySealed).not.toContain("PRIVATE KEY");
    await saveSmartSettings(t.db, t.practiceId, { mode: "smart", clientId: "collab-client" });

    const jwks = createLocalJWKSet(await jwksFor(t.db, t.practiceId) as Parameters<typeof createLocalJWKSet>[0]);
    const calls: string[] = [];
    let tokenRequests = 0;
    const http: SmartHttp = async (url, init) => {
      calls.push(`${init.method ?? "GET"} ${url} ${init.headers.Authorization ?? ""}`);
      if (url === `${BASE}/.well-known/smart-configuration`) return { ok: true, status: 200, json: async () => ({ token_endpoint: TOKEN_URL }) };
      if (url === TOKEN_URL) {
        tokenRequests++;
        const form = new URLSearchParams(init.body);
        expect(form.get("grant_type")).toBe("client_credentials");
        expect(form.get("client_assertion_type")).toBe("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
        expect(form.get("scope")).toBe("system/Patient.read system/Encounter.read system/Practitioner.read");
        const { payload, protectedHeader } = await jwtVerify(form.get("client_assertion")!, jwks, { audience: TOKEN_URL, issuer: "collab-client", subject: "collab-client" });
        expect(protectedHeader.alg).toBe("RS384");
        expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(300);
        expect(payload.jti).toBeTruthy();
        return { ok: true, status: 200, json: async () => ({ access_token: "at-1", token_type: "bearer", expires_in: 300 }) };
      }
      if (url === `${BASE}/metadata`) return { ok: true, status: 200, json: async () => ({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1", software: { name: "Test EHR" } }) };
      return { ok: true, status: 200, json: async () => ({ resourceType: "Bundle", entry: [] }) };
    };

    expect(await testFhir(t.db, t.practiceId, http)).toBe("Test EHR, FHIR 4.0.1");
    await syncFhir(t.db, t.practiceId, { http });
    expect(tokenRequests).toBe(1);
    expect(calls.find((c) => c.startsWith(`GET ${BASE}/metadata`))).toMatch(/Bearer at-1$/);
    expect(calls.some((c) => c.includes("Patient?") && c.endsWith("Bearer at-1"))).toBe(true);
  });

  it("explains a refused token request", async () => {
    await saveSmartSettings(t.db, t.practiceId, { mode: "smart", clientId: "collab-client", tokenUrl: TOKEN_URL });
    const http: SmartHttp = async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid_client", error_description: "unknown key" }) });
    await expect(testFhir(t.db, t.practiceId, http)).rejects.toThrow("The EHR refused the token request (401: invalid_client, unknown key)");
  });
});
