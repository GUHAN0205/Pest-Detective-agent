import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PredictionRow = {
  id: number;
  crop: string;
  prediction: string;
  confidence: string | number;
  severity: string;
  fieldLocation: string | null;
  weatherRisk: string;
  imagePath: string;
  status: string;
  createdAt: string;
  farmerName: string;
};

function pct(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const result = await db.execute<PredictionRow>(sql`
    SELECT
      p.id,
      p.crop,
      p.prediction,
      p.confidence,
      p.severity,
      p.field_location AS "fieldLocation",
      p.weather_risk AS "weatherRisk",
      p.image_path AS "imagePath",
      p.status,
      p.created_at AS "createdAt",
      u.name AS "farmerName"
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    WHERE ${user.role === "admin" ? sql`TRUE` : sql`p.user_id = ${user.id}`}
    ORDER BY p.created_at DESC
  `);

  const rows = result.rows;
  const totalScans = rows.length;
  const healthyCrops = rows.filter((row) => row.prediction.toLowerCase() === "healthy").length;
  const diseasedCrops = totalScans - healthyCrops;
  const averageConfidence = totalScans
    ? Number((rows.reduce((sum, row) => sum + Number(row.confidence), 0) / totalScans).toFixed(1))
    : 0;

  const diseaseStats = Object.values(
    rows.reduce<Record<string, { label: string; count: number; percentage: number }>>((acc, row) => {
      acc[row.prediction] ??= { label: row.prediction, count: 0, percentage: 0 };
      acc[row.prediction].count += 1;
      return acc;
    }, {}),
  )
    .map((item) => ({ ...item, percentage: pct(item.count, totalScans) }))
    .sort((a, b) => b.count - a.count);

  const cropStats = Object.values(
    rows.reduce<Record<string, { label: string; count: number; percentage: number }>>((acc, row) => {
      acc[row.crop] ??= { label: row.crop, count: 0, percentage: 0 };
      acc[row.crop].count += 1;
      return acc;
    }, {}),
  )
    .map((item) => ({ ...item, percentage: pct(item.count, totalScans) }))
    .sort((a, b) => b.count - a.count);

  const riskCounts = rows.reduce(
    (acc, row) => {
      const key = row.weatherRisk.toLowerCase() as "low" | "medium" | "high";
      if (key in acc) acc[key] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 },
  );

  return Response.json({
    stats: {
      totalScans,
      healthyCrops,
      diseasedCrops,
      healthyRate: pct(healthyCrops, totalScans),
      averageConfidence,
      openIssues: rows.filter((row) => row.status !== "Resolved" && row.prediction.toLowerCase() !== "healthy").length,
    },
    diseaseStats,
    cropStats,
    riskCounts,
    recentUploads: rows.slice(0, 6),
  });
}
