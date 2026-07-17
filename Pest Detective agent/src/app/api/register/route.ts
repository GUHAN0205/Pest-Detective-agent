import { db } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { hashPassword, signToken } from "@/lib/security";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  farmName?: string;
  location?: string;
  preferredLanguage?: string;
};

type UserResponse = {
  id: number;
  name: string;
  email: string;
  role: "farmer" | "admin";
  farmName: string | null;
  location: string | null;
  preferredLanguage: string;
};

export async function POST(request: Request) {
  await ensureDatabase();
  const body = (await request.json().catch(() => ({}))) as RegisterBody;
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";

  if (!name || !email || password.length < 8) {
    return Response.json({ error: "Name, valid email, and an 8+ character password are required." }, { status: 400 });
  }

  const existing = await db.execute<{ id: number }>(sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`);
  if (existing.rows.length > 0) {
    return Response.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const result = await db.execute<UserResponse>(sql`
    INSERT INTO users (name, email, password_hash, role, farm_name, location, preferred_language)
    VALUES (${name}, ${email}, ${hashPassword(password)}, ${"farmer"}, ${body.farmName?.trim() || null}, ${body.location?.trim() || null}, ${body.preferredLanguage || "en"})
    RETURNING id, name, email, role, farm_name AS "farmName", location, preferred_language AS "preferredLanguage"
  `);

  const user = result.rows[0];
  const token = signToken({ sub: String(user.id), email: user.email, role: user.role });
  return Response.json({ token, user }, { status: 201 });
}
