import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/security";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ disease: string }>;
};

type RecommendationRow = {
  diseaseId: number;
  crop: string;
  name: string;
  slug: string;
  description: string;
  symptoms: string;
  cause: string;
  organicTreatment: string;
  chemicalTreatment: string;
  preventionTips: string;
  scoutingTips: string;
  weatherRisk: string;
};

export async function GET(request: Request, context: Context) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { disease } = await context.params;
  const term = decodeURIComponent(disease);
  const slug = slugify(term);

  const result = await db.execute<RecommendationRow>(sql`
    SELECT
      d.id AS "diseaseId",
      d.crop,
      d.name,
      d.slug,
      d.description,
      d.symptoms,
      d.cause,
      r.organic_treatment AS "organicTreatment",
      r.chemical_treatment AS "chemicalTreatment",
      r.prevention_tips AS "preventionTips",
      r.scouting_tips AS "scoutingTips",
      r.weather_risk AS "weatherRisk"
    FROM diseases d
    JOIN recommendations r ON r.disease_id = d.id
    WHERE d.slug = ${slug}
      OR LOWER(d.name) = LOWER(${term})
      OR d.slug LIKE ${`%-${slug}`}
    ORDER BY d.crop ASC
    LIMIT 1
  `);

  if (!result.rows[0]) {
    return Response.json({ error: "Recommendation not found." }, { status: 404 });
  }

  return Response.json({ recommendation: result.rows[0] });
}
