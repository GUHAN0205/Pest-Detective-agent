import { db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/security";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

type DiseaseBody = {
  crop?: string;
  name?: string;
  severityDefault?: string;
  description?: string;
  symptoms?: string;
  cause?: string;
  riskFactors?: string;
  imageHints?: string;
  organicTreatment?: string;
  chemicalTreatment?: string;
  preventionTips?: string;
  scoutingTips?: string;
  weatherRisk?: string;
};

export async function PUT(request: Request, context: Context) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid disease id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as DiseaseBody;
  const current = await db.execute<{ crop: string; name: string }>(sql`SELECT crop, name FROM diseases WHERE id = ${id} LIMIT 1`);
  if (current.rows.length === 0) return Response.json({ error: "Disease not found." }, { status: 404 });

  const crop = body.crop?.trim() || current.rows[0].crop;
  const name = body.name?.trim() || current.rows[0].name;
  const slug = `${slugify(crop)}-${slugify(name)}`;

  const updated = await db.execute<{ id: number }>(sql`
    UPDATE diseases
    SET
      crop = ${crop},
      name = ${name},
      slug = ${slug},
      severity_default = ${body.severityDefault || "Medium"},
      description = ${body.description || "No description provided."},
      symptoms = ${body.symptoms || "No symptoms provided."},
      cause = ${body.cause || "Cause details pending."},
      risk_factors = ${body.riskFactors || "Risk details pending."},
      image_hints = ${body.imageHints || null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `).catch(() => null as { rows: Array<{ id: number }> } | null);

  if (!updated?.rows[0]) {
    return Response.json({ error: "Unable to update disease. The crop/name combination may already exist." }, { status: 409 });
  }

  await db.execute(sql`
    INSERT INTO recommendations (disease_id, organic_treatment, chemical_treatment, prevention_tips, scouting_tips, weather_risk)
    VALUES (${id}, ${body.organicTreatment || "Improve sanitation and remove infected tissue where practical."}, ${body.chemicalTreatment || "Follow locally registered products and resistance rotation guidance."}, ${body.preventionTips || "Use clean planting material, rotate crops, and scout weekly."}, ${body.scoutingTips || "Inspect representative field zones and record location, crop stage, and weather."}, ${body.weatherRisk || "Risk depends on local humidity, rainfall, temperature, and canopy density."})
    ON CONFLICT (disease_id) DO UPDATE SET
      organic_treatment = EXCLUDED.organic_treatment,
      chemical_treatment = EXCLUDED.chemical_treatment,
      prevention_tips = EXCLUDED.prevention_tips,
      scouting_tips = EXCLUDED.scouting_tips,
      weather_risk = EXCLUDED.weather_risk,
      updated_at = NOW()
  `);

  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) return Response.json({ error: "Invalid disease id." }, { status: 400 });

  await db.execute(sql`DELETE FROM diseases WHERE id = ${id}`);
  return Response.json({ ok: true });
}
