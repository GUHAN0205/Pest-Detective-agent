import { db } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabase();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, service: "Pest and Disease Scouting System" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
