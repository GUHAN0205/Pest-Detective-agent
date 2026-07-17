import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "farmer" | "admin";
  farmName: string | null;
  location: string | null;
  preferredLanguage: string;
  scanCount: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export async function GET(request: Request) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const result = await db.execute<UserRow>(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.farm_name AS "farmName",
      u.location,
      u.preferred_language AS "preferredLanguage",
      COUNT(p.id)::int AS "scanCount",
      u.created_at AS "createdAt",
      u.last_login_at AS "lastLoginAt"
    FROM users u
    LEFT JOIN predictions p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);

  return Response.json({ users: result.rows });
}
