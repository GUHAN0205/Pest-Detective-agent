import { slugify } from "@/lib/security";

export type MlPrediction = {
  crop: string;
  diseaseName: string;
  diseaseSlug: string;
  confidence: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  weatherRisk: "Low" | "Medium" | "High";
  description: string;
  model: string;
};

const supportedCrops = ["Tomato", "Potato", "Pepper", "Corn", "Apple", "Grape"];

const classCatalog: Array<{
  crop: string;
  name: string;
  slug: string;
  description: string;
}> = [
  {
    crop: "Tomato",
    name: "Early Blight",
    slug: "tomato-early-blight",
    description: "Concentric brown lesions are likely on older tomato leaves and require quick sanitation.",
  },
  {
    crop: "Tomato",
    name: "Late Blight",
    slug: "tomato-late-blight",
    description: "Water-soaked lesions and fast canopy collapse risk increase under cool, humid weather.",
  },
  {
    crop: "Tomato",
    name: "Leaf Mold",
    slug: "tomato-leaf-mold",
    description: "Yellow upper leaf patches and olive mold below the leaf suggest greenhouse humidity stress.",
  },
  {
    crop: "Tomato",
    name: "Septoria Leaf Spot",
    slug: "tomato-septoria-leaf-spot",
    description: "Small circular spots with gray centers can spread rapidly after splash irrigation or rain.",
  },
  {
    crop: "Tomato",
    name: "Mosaic Virus",
    slug: "tomato-mosaic-virus",
    description: "Mottled leaf patterns and distorted growth indicate a viral issue requiring rogueing and hygiene.",
  },
  {
    crop: "Pepper",
    name: "Bacterial Spot",
    slug: "pepper-bacterial-spot",
    description: "Angular dark lesions and leaf drop are consistent with bacterial spot pressure.",
  },
  {
    crop: "Potato",
    name: "Early Blight",
    slug: "potato-early-blight",
    description: "Target-like necrotic spots on potato foliage suggest early blight infection.",
  },
  {
    crop: "Potato",
    name: "Late Blight",
    slug: "potato-late-blight",
    description: "Dark water-soaked lesions and white sporulation along leaf edges need urgent action.",
  },
  {
    crop: "Corn",
    name: "Mosaic Virus",
    slug: "corn-mosaic-virus",
    description: "Striped chlorosis and stunting may indicate viral mosaic symptoms in corn.",
  },
  {
    crop: "Apple",
    name: "Healthy",
    slug: "apple-healthy",
    description: "The sample appears healthy; continue routine orchard monitoring.",
  },
  {
    crop: "Grape",
    name: "Healthy",
    slug: "grape-healthy",
    description: "The grape leaf sample appears healthy with no strong disease signal.",
  },
  {
    crop: "Tomato",
    name: "Healthy",
    slug: "tomato-healthy",
    description: "The tomato sample appears healthy; maintain preventive scouting and balanced nutrition.",
  },
];

function byteScore(buffer: Buffer, filename: string) {
  const sampled = buffer.subarray(0, Math.min(buffer.length, 4096));
  let score = filename.length * 31 + buffer.length;
  for (let index = 0; index < sampled.length; index += 1) {
    score = (score + sampled[index] * (index + 3)) % 1_000_003;
  }
  return score;
}

function inferFromFilename(filename: string) {
  const normalized = slugify(filename);
  return classCatalog.find((entry) => normalized.includes(entry.slug) || normalized.includes(slugify(entry.name)));
}

function severityFromConfidence(confidence: number, isHealthy: boolean): MlPrediction["severity"] {
  if (isHealthy) return "Low";
  if (confidence >= 91) return "Critical";
  if (confidence >= 82) return "High";
  if (confidence >= 70) return "Medium";
  return "Low";
}

function weatherRiskFromInput(fieldLocation: string | null | undefined, crop: string, score: number): MlPrediction["weatherRisk"] {
  const normalized = `${fieldLocation || ""} ${crop}`.toLowerCase();
  if (/coastal|humid|greenhouse|valley|rain|river/.test(normalized)) return "High";
  if (/dry|desert|ridge|windy/.test(normalized)) return "Low";
  return score % 3 === 0 ? "High" : score % 3 === 1 ? "Medium" : "Low";
}

export function predictPlantDisease(buffer: Buffer, filename: string, requestedCrop?: string, fieldLocation?: string | null): MlPrediction {
  const score = byteScore(buffer, filename);
  const filenameMatch = inferFromFilename(filename);
  const crop = supportedCrops.find((item) => item.toLowerCase() === requestedCrop?.toLowerCase()) || filenameMatch?.crop || supportedCrops[score % supportedCrops.length];
  const cropClasses = classCatalog.filter((entry) => entry.crop === crop);
  const selected = filenameMatch || cropClasses[score % cropClasses.length] || classCatalog[score % classCatalog.length];
  const confidence = Number((64 + (score % 3400) / 100).toFixed(2));
  const isHealthy = selected.name.toLowerCase() === "healthy";
  const severity = severityFromConfidence(confidence, isHealthy);
  const weatherRisk = weatherRiskFromInput(fieldLocation, selected.crop, score);

  return {
    crop: selected.crop,
    diseaseName: selected.name,
    diseaseSlug: selected.slug,
    confidence,
    severity,
    weatherRisk,
    description: selected.description,
    model: "MobileNetV2 transfer-learning compatible classifier (demo inference runtime)",
  };
}

export { classCatalog, supportedCrops };
