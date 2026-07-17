import { db } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { getBearerToken, verifyToken } from "@/lib/security";
import { sql } from "drizzle-orm";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "farmer" | "admin";
  farmName: string | null;
  location: string | null;
  preferredLanguage: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  role: "farmer" | "admin";
  exp: number;
  iat: number;
};

export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const payload = verifyToken<SessionPayload>(token);
  if (!payload) return null;

  await ensureDatabase();
  const userId = Number(payload.sub);
  if (!Number.isFinite(userId)) return null;

  const result = await db.execute<AuthUser>(sql`
    SELECT
      id,
      name,
      email,
      role,
      farm_name AS "farmName",
      location,
      preferred_language AS "preferredLanguage"
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `);

  return result.rows[0] || null;
}

export async function requireUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { user: null, response: Response.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function requireAdmin(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth;
  if (auth.user.role !== "admin") {
    return { user: auth.user, response: Response.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return auth;
}
