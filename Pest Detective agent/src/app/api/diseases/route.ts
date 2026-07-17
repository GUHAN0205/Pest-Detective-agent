import { db } from "@/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { slugify } from "@/lib/security";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DiseaseRow = {
  id: number;
  crop: string;
  name: string;
  slug: string;
  severityDefault: string;
  description: string;
  symptoms: string;
  cause: string;
  riskFactors: string;
  imageHints: string | null;
  organicTreatment: string | null;
  chemicalTreatment: string | null;
  preventionTips: string | null;
  scoutingTips: string | null;
  weatherRisk: string | null;
  createdAt: string;
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

export async function GET(request: Request) {
  const { response } = await requireUser(request);
  if (response) return response;

  const result = await db.execute<DiseaseRow>(sql`
    SELECT
      d.id,
      d.crop,
      d.name,
      d.slug,
      d.severity_default AS "severityDefault",
      d.description,
      d.symptoms,
      d.cause,
      d.risk_factors AS "riskFactors",
      d.image_hints AS "imageHints",
      r.organic_treatment AS "organicTreatment",
      r.chemical_treatment AS "chemicalTreatment",
      r.prevention_tips AS "preventionTips",
      r.scouting_tips AS "scoutingTips",
      r.weather_risk AS "weatherRisk",
      d.created_at AS "createdAt"
    FROM diseases d
    LEFT JOIN recommendations r ON r.disease_id = d.id
    ORDER BY d.crop ASC, d.name ASC
  `);

  return Response.json({ diseases: result.rows });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = (await request.json().catch(() => ({}))) as DiseaseBody;
  const crop = body.crop?.trim();
  const name = body.name?.trim();
  const description = body.description?.trim();
  const symptoms = body.symptoms?.trim();
  const cause = body.cause?.trim();

  if (!crop || !name || !description || !symptoms || !cause) {
    return Response.json({ error: "Crop, disease name, description, symptoms, and cause are required." }, { status: 400 });
  }

  const slug = `${slugify(crop)}-${slugify(name)}`;
  const inserted = await db.execute<{ id: number }>(sql`
    INSERT INTO diseases (crop, name, slug, severity_default, description, symptoms, cause, risk_factors, image_hints)
    VALUES (${crop}, ${name}, ${slug}, ${body.severityDefault || "Medium"}, ${description}, ${symptoms}, ${cause}, ${body.riskFactors || "Monitor humid weather, plant stress, and nearby host crops."}, ${body.imageHints || null})
    RETURNING id
  `).catch(() => null);

  if (!inserted?.rows[0]?.id) {
    return Response.json({ error: "A disease with this crop and name already exists." }, { status: 409 });
  }

  const diseaseId = inserted.rows[0].id;
  await db.execute(sql`
    INSERT INTO recommendations (disease_id, organic_treatment, chemical_treatment, prevention_tips, scouting_tips, weather_risk)
    VALUES (${diseaseId}, ${body.organicTreatment || "Improve sanitation and remove infected tissue where practical."}, ${body.chemicalTreatment || "Follow locally registered products and resistance rotation guidance."}, ${body.preventionTips || "Use clean planting material, rotate crops, and scout weekly."}, ${body.scoutingTips || "Inspect representative field zones and record location, crop stage, and weather."}, ${body.weatherRisk || "Risk depends on local humidity, rainfall, temperature, and canopy density."})
  `);

  const result = await db.execute<DiseaseRow>(sql`
    SELECT
      d.id,
      d.crop,
      d.name,
      d.slug,
      d.severity_default AS "severityDefault",
      d.description,
      d.symptoms,
      d.cause,
      d.risk_factors AS "riskFactors",
      d.image_hints AS "imageHints",
      r.organic_treatment AS "organicTreatment",
      r.chemical_treatment AS "chemicalTreatment",
      r.prevention_tips AS "preventionTips",
      r.scouting_tips AS "scoutingTips",
      r.weather_risk AS "weatherRisk",
      d.created_at AS "createdAt"
    FROM diseases d
    LEFT JOIN recommendations r ON r.disease_id = d.id
    WHERE d.id = ${diseaseId}
  `);

  return Response.json({ disease: result.rows[0] }, { status: 201 });
}
