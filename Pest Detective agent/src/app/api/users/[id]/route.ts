import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type UserBody = {
  name?: string;
  role?: "farmer" | "admin";
  farmName?: string;
  location?: string;
  preferredLanguage?: string;
};

export async function PUT(request: Request, context: Context) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid user id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as UserBody;
  const role = body.role === "admin" ? "admin" : "farmer";

  const result = await db.execute(sql`
    UPDATE users
    SET
      name = ${body.name?.trim() || "Unnamed Farmer"},
      role = ${role},
      farm_name = ${body.farmName?.trim() || null},
      location = ${body.location?.trim() || null},
      preferred_language = ${body.preferredLanguage || "en"},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, email, role, farm_name AS "farmName", location, preferred_language AS "preferredLanguage"
  `);

  if (!result.rows[0]) return Response.json({ error: "User not found." }, { status: 404 });
  return Response.json({ user: result.rows[0], currentUserRoleChanged: user.id === id && role !== "admin" });
}

export async function DELETE(request: Request, context: Context) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid user id." }, { status: 400 });
  if (id === user.id) return Response.json({ error: "Admins cannot delete their own account while signed in." }, { status: 400 });

  await db.execute(sql`DELETE FROM users WHERE id = ${id}`);
  return Response.json({ ok: true });
}
