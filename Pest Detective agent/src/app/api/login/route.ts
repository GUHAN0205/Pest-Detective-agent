import { db } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { signToken, verifyPassword } from "@/lib/security";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

type LoginRow = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: "farmer" | "admin";
  farmName: string | null;
  location: string | null;
  preferredLanguage: string;
};

export async function POST(request: Request) {
  await ensureDatabase();
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await db.execute<LoginRow>(sql`
    SELECT
      id,
      name,
      email,
      password_hash AS "passwordHash",
      role,
      farm_name AS "farmName",
      location,
      preferred_language AS "preferredLanguage"
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `);

  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await db.execute(sql`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${row.id}`);

  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    farmName: row.farmName,
    location: row.location,
    preferredLanguage: row.preferredLanguage,
  };
  const token = signToken({ sub: String(user.id), email: user.email, role: user.role });
  return Response.json({ token, user });
}
