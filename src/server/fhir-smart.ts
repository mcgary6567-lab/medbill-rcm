/**
 * SMART Backend Services (HL7 SMART App Launch, "backend services"): instead of
 * a pasted token that expires, CollaboratMD holds a private key, the EHR holds
 * the matching public key (from our JWKS URL), and each sync asks the EHR's
 * token endpoint for a short-lived access token with a signed JWT
 * (client_credentials grant, private_key_jwt client authentication, RS384).
 *
 * The private key is generated here, sealed before it is stored, and never
 * leaves the server. Rotating it is generating a new one; the EHR then needs
 * the JWKS URL again only if it caches keys.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair, importPKCS8 } from "jose";
import type { Db } from "@/db";
import { schema } from "@/db";
import { appSecret } from "@/lib/app-secret";
import { seal, unseal } from "@/lib/seal";

const { fhirConnections, auditLog } = schema;
const ALG = "RS384";
export const DEFAULT_SCOPE = "system/Patient.read system/Encounter.read system/Practitioner.read";

export type SmartHttp = (url: string, init: { method?: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
type Conn = typeof fhirConnections.$inferSelect;

/** Makes (or replaces) the practice's signing key; returns the public key to register with the EHR. */
export async function generateSmartKey(db: Db, practiceId: string, userId?: string) {
  const [conn] = await db.select().from(fhirConnections).where(eq(fhirConnections.practiceId, practiceId)).limit(1);
  if (!conn) throw new Error("Save the FHIR base URL first");
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true, modulusLength: 2048 });
  const keyId = randomBytes(8).toString("hex");
  const publicJwk = { ...(await exportJWK(publicKey)), kid: keyId, alg: ALG, use: "sig", key_ops: ["verify"] };
  const privateKeySealed = seal(await exportPKCS8(privateKey), appSecret());
  await db.update(fhirConnections).set({ keyId, publicJwk, privateKeySealed }).where(eq(fhirConnections.practiceId, practiceId));
  await db.insert(auditLog).values({ practiceId, userId: userId ?? null, action: "fhir_key_generated", entity: "practice", entityId: practiceId, details: { keyId } });
  tokens.delete(practiceId);
  return publicJwk;
}

export async function saveSmartSettings(db: Db, practiceId: string, input: { mode: string; clientId?: string; tokenUrl?: string; scope?: string }, userId?: string) {
  const mode = input.mode === "smart" ? "smart" : "token";
  const clientId = input.clientId?.trim() || null;
  const tokenUrl = input.tokenUrl?.trim().replace(/\/$/, "") || null;
  if (mode === "smart" && !clientId) throw new Error("Enter the client ID the EHR gave your backend app");
  if (tokenUrl && !/^https:\/\/\S+$/.test(tokenUrl)) throw new Error("The token URL must start with https://");
  const scope = input.scope?.trim() || DEFAULT_SCOPE;
  const updated = await db.update(fhirConnections).set({ authMode: mode, clientId, tokenUrl, scope }).where(eq(fhirConnections.practiceId, practiceId)).returning();
  if (!updated.length) throw new Error("Save the FHIR base URL first");
  await db.insert(auditLog).values({ practiceId, userId: userId ?? null, action: "fhir_auth_saved", entity: "practice", entityId: practiceId, details: { mode, clientId } });
  tokens.delete(practiceId);
}

/** The public keys for an EHR to verify our assertions (served at /api/fhir/jwks/<practice id>). */
export async function jwksFor(db: Db, practiceId: string) {
  const [conn] = await db.select({ publicJwk: fhirConnections.publicJwk }).from(fhirConnections).where(eq(fhirConnections.practiceId, practiceId)).limit(1);
  return { keys: conn?.publicJwk ? [conn.publicJwk] : [] };
}

/** The token endpoint: as saved, or from the server's /.well-known/smart-configuration. */
async function tokenEndpoint(conn: Conn, http: SmartHttp): Promise<string> {
  if (conn.tokenUrl) return conn.tokenUrl;
  const res = await http(`${conn.baseUrl}/.well-known/smart-configuration`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`The FHIR server has no SMART configuration (${res.status}); enter its token URL`);
  const url = ((await res.json()) as { token_endpoint?: string }).token_endpoint;
  if (!url || !/^https:\/\//.test(url)) throw new Error("The FHIR server's SMART configuration has no https token endpoint; enter its token URL");
  return url;
}

/** Signed client assertion (RFC 7523) for one token request. */
export async function clientAssertion(conn: Pick<Conn, "clientId" | "keyId" | "privateKeySealed">, audience: string, now = new Date()) {
  if (!conn.clientId || !conn.keyId || !conn.privateKeySealed) throw new Error("Generate a signing key and enter the client ID first");
  const key = await importPKCS8(unseal(conn.privateKeySealed, appSecret()), ALG);
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid: conn.keyId, typ: "JWT" })
    .setIssuer(conn.clientId)
    .setSubject(conn.clientId)
    .setAudience(audience)
    .setJti(randomBytes(16).toString("hex"))
    .setIssuedAt(iat)
    .setExpirationTime(iat + 300)
    .sign(key);
}

const tokens = new Map<string, { token: string; until: number }>();

/** An access token for this practice's FHIR server, reused until a minute before it expires. */
export async function smartAccessToken(conn: Conn, http: SmartHttp, now = new Date()): Promise<string> {
  const cached = tokens.get(conn.practiceId);
  if (cached && cached.until > now.getTime()) return cached.token;
  const url = await tokenEndpoint(conn, http);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: conn.scope || DEFAULT_SCOPE,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await clientAssertion(conn, url, now),
  }).toString();
  const res = await http(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`The EHR refused the token request (${res.status}${json.error ? `: ${json.error}${json.error_description ? `, ${json.error_description}` : ""}` : ""})`);
  tokens.set(conn.practiceId, { token: json.access_token, until: now.getTime() + Math.max(0, (json.expires_in ?? 300) - 60) * 1000 });
  return json.access_token;
}

export function clearSmartTokens() {
  tokens.clear();
}
