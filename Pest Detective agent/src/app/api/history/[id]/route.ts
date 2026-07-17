import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type UpdateBody = {
  status?: string;
  notes?: string;
};

async function canAccessPrediction(id: number, userId: number, role: string) {
  const result = await db.execute<{ userId: number }>(sql`SELECT user_id AS "userId" FROM predictions WHERE id = ${id} LIMIT 1`);
  const owner = result.rows[0];
  return Boolean(owner && (role === "admin" || owner.userId === userId));
}

export async function PUT(request: Request, context: Context) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid history id." }, { status: 400 });

  if (!(await canAccessPrediction(id, user.id, user.role))) {
    return Response.json({ error: "Prediction not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  const allowedStatuses = new Set(["Open", "In Review", "Resolved"]);
  const status = allowedStatuses.has(body.status || "") ? body.status : "Open";
  const notes = body.notes?.trim() || null;

  const result = await db.execute(sql`
    UPDATE predictions
    SET status = ${status}, notes = ${notes}
    WHERE id = ${id}
    RETURNING id, status, notes
  `);

  return Response.json({ prediction: result.rows[0] });
}

export async function DELETE(request: Request, context: Context) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid history id." }, { status: 400 });

  if (!(await canAccessPrediction(id, user.id, user.role))) {
    return Response.json({ error: "Prediction not found." }, { status: 404 });
  }

  await db.execute(sql`DELETE FROM predictions WHERE id = ${id}`);
  return Response.json({ ok: true });
}
