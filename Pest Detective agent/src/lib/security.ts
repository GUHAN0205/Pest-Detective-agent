import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

type JwtPayload = Record<string, unknown> & {
  sub: string;
  exp: number;
  iat: number;
};

const algorithm = "sha256";

function getSecret() {
  return process.env.JWT_SECRET || "local-development-pest-scouting-secret";
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(key, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

export function signToken(payload: { sub: string } & Record<string, unknown>, expiresInSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
  const signature = createHmac(algorithm, getSecret()).update(unsigned).digest();
  return `${unsigned}.${base64Url(signature)}`;
}

export function verifyToken<T extends JwtPayload>(token: string): T | null {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = base64Url(createHmac(algorithm, getSecret()).update(unsigned).digest());
  const provided = Buffer.from(encodedSignature);
  const actual = Buffer.from(expected);

  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as T;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
