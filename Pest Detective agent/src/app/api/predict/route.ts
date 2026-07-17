import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { predictPlantDisease } from "@/lib/ml";
import { slugify } from "@/lib/security";
import { sql } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DiseaseRow = {
  id: number;
  crop: string;
  name: string;
  slug: string;
  description: string;
  symptoms: string;
  cause: string;
  organicTreatment: string | null;
  chemicalTreatment: string | null;
  preventionTips: string | null;
  scoutingTips: string | null;
  weatherRiskText: string | null;
};

type PredictionRow = {
  id: number;
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
};

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  const formData = await request.formData();
  const image = formData.get("image");
  const requestedCrop = String(formData.get("crop") || "");
  const fieldLocation = String(formData.get("fieldLocation") || user.location || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!(image instanceof File)) {
    return Response.json({ error: "Please upload a crop leaf image." }, { status: 400 });
  }

  const extension = allowedTypes[image.type];
  if (!extension) {
    return Response.json({ error: "Only JPG, PNG, and WEBP image formats are supported." }, { status: 415 });
  }

  if (image.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Image must be smaller than 8MB." }, { status: 413 });
  }

  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const prediction = predictPlantDisease(buffer, image.name, requestedCrop, fieldLocation);

  const uploadDirectory = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDirectory, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}-${slugify(image.name.replace(/\.[^.]+$/, ""))}.${extension}`;
  const filePath = join(uploadDirectory, fileName);
  await writeFile(filePath, buffer);
  const publicPath = `/uploads/${fileName}`;

  let disease = await db.execute<DiseaseRow>(sql`
    SELECT
      d.id,
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
      r.weather_risk AS "weatherRiskText"
    FROM diseases d
    LEFT JOIN recommendations r ON r.disease_id = d.id
    WHERE d.slug = ${prediction.diseaseSlug}
    LIMIT 1
  `);

  if (disease.rows.length === 0) {
    disease = await db.execute<DiseaseRow>(sql`
      SELECT
        d.id,
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
        r.weather_risk AS "weatherRiskText"
      FROM diseases d
      LEFT JOIN recommendations r ON r.disease_id = d.id
      WHERE d.crop = ${prediction.crop}
      ORDER BY CASE WHEN LOWER(d.name) = 'healthy' THEN 0 ELSE 1 END
      LIMIT 1
    `);
  }

  const diseaseRow = disease.rows[0] || null;
  const inserted = await db.execute<PredictionRow>(sql`
    INSERT INTO predictions (user_id, disease_id, image_path, crop, prediction, confidence, severity, field_location, notes, weather_risk, status)
    VALUES (${user.id}, ${diseaseRow?.id || null}, ${publicPath}, ${prediction.crop}, ${prediction.diseaseName}, ${prediction.confidence}, ${prediction.severity}, ${fieldLocation || null}, ${notes || null}, ${prediction.weatherRisk}, ${prediction.diseaseName === "Healthy" ? "Resolved" : "Open"})
    RETURNING
      id,
      crop,
      prediction,
      confidence,
      severity,
      field_location AS "fieldLocation",
      notes,
      weather_risk AS "weatherRisk",
      status,
      image_path AS "imagePath",
      created_at AS "createdAt"
  `);

  return Response.json({
    prediction: {
      ...inserted.rows[0],
      confidence: Number(inserted.rows[0].confidence),
      description: diseaseRow?.description || prediction.description,
      model: prediction.model,
    },
    disease: diseaseRow,
    recommendation: diseaseRow
      ? {
          symptoms: diseaseRow.symptoms,
          cause: diseaseRow.cause,
          organicTreatment: diseaseRow.organicTreatment,
          chemicalTreatment: diseaseRow.chemicalTreatment,
          preventionTips: diseaseRow.preventionTips,
          scoutingTips: diseaseRow.scoutingTips,
          weatherRisk: diseaseRow.weatherRiskText,
        }
      : null,
  });
}
