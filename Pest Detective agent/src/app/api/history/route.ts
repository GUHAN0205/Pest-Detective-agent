import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HistoryRow = {
  id: number;
  userId: number;
  farmerName: string;
  crop: string;
  prediction: string;
  confidence: string | number;
  severity: string;
  fieldLocation: string | null;
  notes: string | null;
  weatherRisk: string;
  status: string;
  imagePath: string;
  createdAt: string;
  diseaseDescription: string | null;
  symptoms: string | null;
  cause: string | null;
  organicTreatment: string | null;
  chemicalTreatment: string | null;
  preventionTips: string | null;
};

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const crop = url.searchParams.get("crop") || "All";
  const severity = url.searchParams.get("severity") || "All";
  const status = url.searchParams.get("status") || "All";

  const result = await db.execute<HistoryRow>(sql`
    SELECT
      p.id,
      p.user_id AS "userId",
      u.name AS "farmerName",
      p.crop,
      p.prediction,
      p.confidence,
      p.severity,
      p.field_location AS "fieldLocation",
      p.notes,
      p.weather_risk AS "weatherRisk",
      p.status,
      p.image_path AS "imagePath",
      p.created_at AS "createdAt",
      d.description AS "diseaseDescription",
      d.symptoms,
      d.cause,
      r.organic_treatment AS "organicTreatment",
      r.chemical_treatment AS "chemicalTreatment",
      r.prevention_tips AS "preventionTips"
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN diseases d ON d.id = p.disease_id
    LEFT JOIN recommendations r ON r.disease_id = d.id
    WHERE ${user.role === "admin" ? sql`TRUE` : sql`p.user_id = ${user.id}`}
    ORDER BY p.created_at DESC
  `);

  const rows = result.rows
    .map((row) => ({ ...row, confidence: Number(row.confidence) }))
    .filter((row) => {
      const haystack = `${row.crop} ${row.prediction} ${row.fieldLocation || ""} ${row.notes || ""} ${row.farmerName}`.toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (crop === "All" || row.crop === crop) &&
        (severity === "All" || row.severity === severity) &&
        (status === "All" || row.status === status)
      );
    });

  return Response.json({ history: rows });
}
