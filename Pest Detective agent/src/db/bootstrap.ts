import { db } from "@/db";
import { hashPassword, slugify } from "@/lib/security";
import { sql } from "drizzle-orm";

let bootstrapPromise: Promise<void> | null = null;

type DiseaseSeed = {
  crop: string;
  name: string;
  severity: string;
  description: string;
  symptoms: string;
  cause: string;
  riskFactors: string;
  imageHints: string;
  organicTreatment: string;
  chemicalTreatment: string;
  preventionTips: string;
  scoutingTips: string;
  weatherRisk: string;
};

const diseaseSeeds: DiseaseSeed[] = [
  {
    crop: "Tomato",
    name: "Early Blight",
    severity: "High",
    description: "A fungal disease that starts on older leaves and can defoliate tomato plants if unmanaged.",
    symptoms: "Brown target-like rings, yellowing around lesions, lower-leaf drop, and reduced fruit cover.",
    cause: "Alternaria spores surviving on crop residue, stakes, volunteer plants, and infected seed.",
    riskFactors: "Warm days, heavy dew, overhead irrigation, dense canopy, and repeated tomato or potato rotations.",
    imageHints: "Concentric rings on lower leaves with yellow halos.",
    organicTreatment: "Remove infected leaves, mulch soil, apply compost tea only as a supplement, and use copper or Bacillus-based biofungicides where allowed.",
    chemicalTreatment: "Use labeled chlorothalonil, mancozeb, azoxystrobin, or other locally approved fungicides in rotation.",
    preventionTips: "Rotate solanaceous crops for 2-3 years, stake plants, sanitize tools, and water at soil level early in the day.",
    scoutingTips: "Inspect lower leaves twice weekly from flowering through harvest and flag hot spots for follow-up.",
    weatherRisk: "Risk rises after warm rain events and long leaf-wetness periods.",
  },
  {
    crop: "Tomato",
    name: "Late Blight",
    severity: "Critical",
    description: "A fast-moving oomycete disease capable of destroying tomato and potato foliage within days.",
    symptoms: "Water-soaked gray-green lesions, white fuzzy growth on leaf undersides, dark stems, and greasy fruit spots.",
    cause: "Phytophthora infestans spores moved by wind, storms, infected transplants, or cull piles.",
    riskFactors: "Cool temperatures, high humidity, fog, prolonged rain, and nearby infected potato or tomato fields.",
    imageHints: "Large wet lesions with pale sporulation along edges.",
    organicTreatment: "Destroy infected plants promptly, avoid composting diseased tissue, improve airflow, and apply allowed copper protectants preventively.",
    chemicalTreatment: "Use locally recommended protectant and systemic late-blight fungicides with strict resistance rotation.",
    preventionTips: "Plant certified seed/transplants, remove volunteers and cull piles, monitor regional alerts, and avoid overhead irrigation.",
    scoutingTips: "Scout field edges and low wet areas after cool rainy nights; act immediately on suspect lesions.",
    weatherRisk: "Highest during cool, wet, cloudy weather with extended leaf wetness.",
  },
  {
    crop: "Tomato",
    name: "Leaf Mold",
    severity: "Medium",
    description: "A greenhouse-favored fungal disease that thrives when humidity stays high around tomato foliage.",
    symptoms: "Pale yellow spots on upper leaf surfaces with olive-gray mold growth underneath.",
    cause: "Passalora fulva spores persisting on debris, structures, and infected leaves.",
    riskFactors: "Relative humidity above 85%, poor ventilation, dense canopy, and warm protected environments.",
    imageHints: "Yellow blotches paired with fuzzy olive underside growth.",
    organicTreatment: "Prune for airflow, remove affected leaves, lower humidity, and apply labeled biological fungicides.",
    chemicalTreatment: "Use labeled protectant fungicides if environmental correction and sanitation are insufficient.",
    preventionTips: "Ventilate tunnels and greenhouses, use resistant varieties, space plants, and avoid evening irrigation.",
    scoutingTips: "Check shaded interior canopy leaves and record humidity trends.",
    weatherRisk: "Risk is high in protected culture when night humidity remains elevated.",
  },
  {
    crop: "Tomato",
    name: "Septoria Leaf Spot",
    severity: "High",
    description: "A common tomato leaf spot disease that spreads by splashing water and can quickly defoliate plants.",
    symptoms: "Many small circular spots with dark margins, gray centers, and tiny black fruiting bodies.",
    cause: "Septoria spores surviving on debris, weeds, stakes, and volunteer tomato plants.",
    riskFactors: "Frequent rain, overhead irrigation, weedy borders, and wet lower foliage.",
    imageHints: "Numerous small spots with gray centers on lower leaves.",
    organicTreatment: "Remove infected leaves, mulch, prune low foliage, and apply copper or biological protectants as permitted.",
    chemicalTreatment: "Rotate labeled fungicides such as chlorothalonil, mancozeb, or strobilurins according to local guidance.",
    preventionTips: "Use clean stakes, rotate crops, improve airflow, and water at the base.",
    scoutingTips: "Begin lower-canopy scouting soon after transplanting, especially after rain splash.",
    weatherRisk: "Risk increases sharply during warm rainy periods.",
  },
  {
    crop: "Tomato",
    name: "Mosaic Virus",
    severity: "High",
    description: "A viral disease that causes mottling and distortion and cannot be cured after infection.",
    symptoms: "Light and dark green mosaic mottling, shoestring leaves, curling, stunting, and uneven fruit ripening.",
    cause: "Virus transmission through seed, infected plant sap, tools, hands, and sometimes insect vectors.",
    riskFactors: "Poor sanitation, tobacco handling near crops, infected transplants, and uncontrolled weeds.",
    imageHints: "Mottled mosaic pattern with leaf distortion.",
    organicTreatment: "Rogue infected plants, sanitize hands and tools, control weeds, and remove volunteer hosts.",
    chemicalTreatment: "No curative chemical treatment exists; manage vectors only when they are confirmed and above threshold.",
    preventionTips: "Use certified seed, resistant varieties, strict hygiene, and disinfect pruning equipment between plants.",
    scoutingTips: "Mark symptomatic plants and inspect adjacent rows for spread patterns.",
    weatherRisk: "Weather is less direct, but stressed plants and active vectors can increase field impact.",
  },
  {
    crop: "Pepper",
    name: "Bacterial Spot",
    severity: "High",
    description: "A bacterial disease affecting pepper leaves and fruit, often causing serious defoliation.",
    symptoms: "Small water-soaked lesions becoming dark and angular, leaf yellowing, fruit scabs, and leaf drop.",
    cause: "Xanthomonas bacteria spread by seed, transplants, rain splash, workers, and equipment.",
    riskFactors: "Warm storms, overhead irrigation, handling wet plants, and contaminated seed lots.",
    imageHints: "Angular dark spots with yellow halos on pepper leaves.",
    organicTreatment: "Use disease-free seed, remove infected seedlings, apply copper cautiously, and avoid working wet plants.",
    chemicalTreatment: "Copper plus labeled partners may suppress spread; rotate and follow resistance-management guidance.",
    preventionTips: "Start with certified seed/transplants, rotate away from peppers/tomatoes, sanitize trays, and use drip irrigation.",
    scoutingTips: "Scout after storms and inspect windward field edges for splash-driven hot spots.",
    weatherRisk: "Highest during warm, windy rain events.",
  },
  {
    crop: "Potato",
    name: "Early Blight",
    severity: "Medium",
    description: "A foliar disease of potato that reduces photosynthetic area and may affect tubers under pressure.",
    symptoms: "Dark target spots on older leaves, yellowing, premature senescence, and occasional tuber lesions.",
    cause: "Alternaria fungi favored by plant stress and spores from debris or neighboring fields.",
    riskFactors: "Nutrient stress, drought followed by humidity, aging vines, and short rotations.",
    imageHints: "Target lesions on older potato foliage.",
    organicTreatment: "Maintain fertility, irrigate evenly, remove cull piles, and apply approved biological or copper products preventively.",
    chemicalTreatment: "Use labeled protectant and systemic fungicides with rotation among FRAC groups.",
    preventionTips: "Rotate crops, plant vigorous seed, avoid stress, and manage volunteer potatoes.",
    scoutingTips: "Track lower-leaf lesions and note vine age and stress conditions.",
    weatherRisk: "Moderate to high when stressed plants experience alternating dry and humid periods.",
  },
  {
    crop: "Potato",
    name: "Late Blight",
    severity: "Critical",
    description: "A destructive potato disease requiring immediate containment and coordinated regional management.",
    symptoms: "Irregular water-soaked lesions, pale fungal growth under leaves, dark stems, and tuber rot.",
    cause: "Phytophthora infestans spread by airborne spores and infected tubers or cull piles.",
    riskFactors: "Cool wet weather, volunteer potatoes, infected seed, and unmanaged cull piles.",
    imageHints: "Water-soaked potato lesions with white leaf-edge growth.",
    organicTreatment: "Destroy infected volunteer plants and culls, hill properly, and use allowed copper protectants before infection periods.",
    chemicalTreatment: "Follow local late-blight programs using protectant and systemic fungicides with resistance rotation.",
    preventionTips: "Use certified seed, eliminate culls, monitor alerts, and maintain protective coverage before forecasted infection periods.",
    scoutingTips: "Inspect low wet areas, field edges, and downwind sides after humid nights.",
    weatherRisk: "Very high during cool rainy weather and persistent fog.",
  },
  {
    crop: "Corn",
    name: "Mosaic Virus",
    severity: "Medium",
    description: "A viral corn disease that can reduce stand vigor and yield when plants are infected early.",
    symptoms: "Mosaic striping, chlorotic streaks, stunting, and uneven plant height.",
    cause: "Virus spread by aphids or infected grass hosts depending on the local virus complex.",
    riskFactors: "Nearby grassy weeds, early-season aphid flights, and susceptible hybrids.",
    imageHints: "Light-green striping and mosaic bands on corn leaves.",
    organicTreatment: "Control grassy weed hosts, remove heavily affected plants in small plots, and improve crop vigor.",
    chemicalTreatment: "No curative treatment; vector control may be considered only when scouting confirms threshold pressure.",
    preventionTips: "Plant tolerant hybrids, manage weeds before planting, and avoid late planting in high-risk areas.",
    scoutingTips: "Check field margins and low-vigor zones for clusters of stunted plants.",
    weatherRisk: "Vector activity and weed host pressure shape risk more than leaf wetness.",
  },
  {
    crop: "Apple",
    name: "Healthy",
    severity: "Low",
    description: "No strong disease signal is present in the sample; keep following orchard IPM practices.",
    symptoms: "Uniform leaf color, no expanding lesions, and normal leaf shape.",
    cause: "Healthy tissue; no pathogen symptoms detected by the scouting workflow.",
    riskFactors: "Risk can still rise after wet weather, poor airflow, or nearby unmanaged host plants.",
    imageHints: "Clean apple leaves with even color and margins.",
    organicTreatment: "No treatment required; maintain nutrition, irrigation, and sanitation.",
    chemicalTreatment: "No chemical treatment recommended for a healthy sample.",
    preventionTips: "Continue monitoring, prune for airflow, and follow local disease forecasting alerts.",
    scoutingTips: "Document healthy blocks to compare against future scouting rounds.",
    weatherRisk: "Low now, but monitor after rain and high humidity.",
  },
  {
    crop: "Grape",
    name: "Healthy",
    severity: "Low",
    description: "No actionable disease symptoms were detected in this grape leaf sample.",
    symptoms: "Even coloration, intact leaf margins, and absence of mildew or necrotic lesions.",
    cause: "Healthy tissue; continue preventive canopy and disease management.",
    riskFactors: "Dense canopies, high humidity, and poor spray coverage can increase future disease risk.",
    imageHints: "Healthy grape leaf with no mildew or spotting.",
    organicTreatment: "No treatment required; keep canopy open and remove debris.",
    chemicalTreatment: "No chemical treatment recommended for a healthy sample.",
    preventionTips: "Maintain airflow, balanced vigor, and routine scouting for mildew and rot symptoms.",
    scoutingTips: "Use healthy scans as baseline records for the block.",
    weatherRisk: "Low unless humidity and dense canopy conditions increase.",
  },
  {
    crop: "Tomato",
    name: "Healthy",
    severity: "Low",
    description: "The tomato sample appears healthy and should remain on a preventive scouting schedule.",
    symptoms: "No strong spotting, chlorosis, mosaic pattern, or mold growth detected.",
    cause: "Healthy tissue; no disease pressure detected in this image.",
    riskFactors: "Nearby diseased plants, wet leaves, dense canopy, and poor crop rotation can change risk quickly.",
    imageHints: "Uniform tomato leaf with no visible lesions.",
    organicTreatment: "No treatment required; focus on sanitation and plant vigor.",
    chemicalTreatment: "No chemical treatment recommended for a healthy sample.",
    preventionTips: "Continue weekly scouting, mulch soil, prune for airflow, and avoid overhead irrigation.",
    scoutingTips: "Record block location and compare with future scans after weather events.",
    weatherRisk: "Low to medium depending on rain and humidity forecast.",
  },
];

async function createTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(24) NOT NULL DEFAULT 'farmer',
      farm_name VARCHAR(160),
      location VARCHAR(180),
      preferred_language VARCHAR(24) NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS diseases (
      id SERIAL PRIMARY KEY,
      crop VARCHAR(80) NOT NULL,
      name VARCHAR(140) NOT NULL,
      slug VARCHAR(180) NOT NULL UNIQUE,
      severity_default VARCHAR(32) NOT NULL DEFAULT 'Medium',
      description TEXT NOT NULL,
      symptoms TEXT NOT NULL,
      cause TEXT NOT NULL,
      risk_factors TEXT NOT NULL,
      image_hints TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendations (
      id SERIAL PRIMARY KEY,
      disease_id INTEGER NOT NULL UNIQUE REFERENCES diseases(id) ON DELETE CASCADE,
      organic_treatment TEXT NOT NULL,
      chemical_treatment TEXT NOT NULL,
      prevention_tips TEXT NOT NULL,
      scouting_tips TEXT NOT NULL,
      weather_risk TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      disease_id INTEGER REFERENCES diseases(id) ON DELETE SET NULL,
      image_path TEXT NOT NULL,
      crop VARCHAR(80) NOT NULL,
      prediction VARCHAR(160) NOT NULL,
      confidence NUMERIC(5, 2) NOT NULL,
      severity VARCHAR(32) NOT NULL,
      field_location VARCHAR(180),
      notes TEXT,
      weather_risk VARCHAR(32) NOT NULL DEFAULT 'Medium',
      status VARCHAR(32) NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS users_role_idx ON users(role)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS diseases_crop_idx ON diseases(crop)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS diseases_name_idx ON diseases(name)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS predictions_user_idx ON predictions(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS predictions_created_idx ON predictions(created_at DESC)`);
}

async function seedData() {
  const usersCount = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM users`);
  if ((usersCount.rows[0]?.count || 0) === 0) {
    await db.execute(sql`
      INSERT INTO users (name, email, password_hash, role, farm_name, location, preferred_language, last_login_at)
      VALUES
        (${"Amara Fields"}, ${"farmer@demo.com"}, ${hashPassword("password123")}, ${"farmer"}, ${"Riverbend Cooperative Farm"}, ${"Salinas Valley Block 4"}, ${"en"}, NOW() - INTERVAL '1 day'),
        (${"Diego Navarro"}, ${"admin@demo.com"}, ${hashPassword("admin123")}, ${"admin"}, ${"Regional Plant Health Lab"}, ${"Central Valley HQ"}, ${"en"}, NOW() - INTERVAL '3 hours'),
        (${"Lina Okoro"}, ${"lina@demo.com"}, ${hashPassword("password123")}, ${"farmer"}, ${"Sunrise Pepper Fields"}, ${"Humid River Plot"}, ${"es"}, NOW() - INTERVAL '2 days')
    `);
  }

  const diseaseCount = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM diseases`);
  if ((diseaseCount.rows[0]?.count || 0) === 0) {
    for (const seed of diseaseSeeds) {
      const slug = `${slugify(seed.crop)}-${slugify(seed.name)}`;
      const disease = await db.execute<{ id: number }>(sql`
        INSERT INTO diseases (crop, name, slug, severity_default, description, symptoms, cause, risk_factors, image_hints)
        VALUES (${seed.crop}, ${seed.name}, ${slug}, ${seed.severity}, ${seed.description}, ${seed.symptoms}, ${seed.cause}, ${seed.riskFactors}, ${seed.imageHints})
        RETURNING id
      `);
      const diseaseId = disease.rows[0]?.id;
      if (diseaseId) {
        await db.execute(sql`
          INSERT INTO recommendations (disease_id, organic_treatment, chemical_treatment, prevention_tips, scouting_tips, weather_risk)
          VALUES (${diseaseId}, ${seed.organicTreatment}, ${seed.chemicalTreatment}, ${seed.preventionTips}, ${seed.scoutingTips}, ${seed.weatherRisk})
        `);
      }
    }
  }

  const predictionCount = await db.execute<{ count: number }>(sql`SELECT COUNT(*)::int AS count FROM predictions`);
  if ((predictionCount.rows[0]?.count || 0) === 0) {
    const farmer = await db.execute<{ id: number }>(sql`SELECT id FROM users WHERE email = ${"farmer@demo.com"} LIMIT 1`);
    const lina = await db.execute<{ id: number }>(sql`SELECT id FROM users WHERE email = ${"lina@demo.com"} LIMIT 1`);
    const early = await db.execute<{ id: number }>(sql`SELECT id FROM diseases WHERE slug = ${"tomato-early-blight"} LIMIT 1`);
    const healthy = await db.execute<{ id: number }>(sql`SELECT id FROM diseases WHERE slug = ${"grape-healthy"} LIMIT 1`);
    const bacterial = await db.execute<{ id: number }>(sql`SELECT id FROM diseases WHERE slug = ${"pepper-bacterial-spot"} LIMIT 1`);
    const late = await db.execute<{ id: number }>(sql`SELECT id FROM diseases WHERE slug = ${"potato-late-blight"} LIMIT 1`);

    if (farmer.rows[0]?.id && early.rows[0]?.id && healthy.rows[0]?.id && late.rows[0]?.id) {
      await db.execute(sql`
        INSERT INTO predictions (user_id, disease_id, image_path, crop, prediction, confidence, severity, field_location, notes, weather_risk, status, created_at)
        VALUES
          (${farmer.rows[0].id}, ${early.rows[0].id}, ${"/uploads/demo-tomato-early-blight.svg"}, ${"Tomato"}, ${"Early Blight"}, ${88.40}, ${"High"}, ${"North Tomato Tunnel"}, ${"Lower canopy spots after humid week."}, ${"High"}, ${"Open"}, NOW() - INTERVAL '2 hours'),
          (${farmer.rows[0].id}, ${healthy.rows[0].id}, ${"/uploads/demo-grape-healthy.svg"}, ${"Grape"}, ${"Healthy"}, ${93.10}, ${"Low"}, ${"Grape Block B"}, ${"Routine monitoring scan."}, ${"Low"}, ${"Resolved"}, NOW() - INTERVAL '1 day'),
          (${farmer.rows[0].id}, ${late.rows[0].id}, ${"/uploads/demo-potato-late-blight.svg"}, ${"Potato"}, ${"Late Blight"}, ${91.70}, ${"Critical"}, ${"Low wet field edge"}, ${"Follow-up required before rain forecast."}, ${"High"}, ${"Open"}, NOW() - INTERVAL '3 days')
      `);
    }

    if (lina.rows[0]?.id && bacterial.rows[0]?.id) {
      await db.execute(sql`
        INSERT INTO predictions (user_id, disease_id, image_path, crop, prediction, confidence, severity, field_location, notes, weather_risk, status, created_at)
        VALUES (${lina.rows[0].id}, ${bacterial.rows[0].id}, ${"/uploads/demo-pepper-bacterial-spot.svg"}, ${"Pepper"}, ${"Bacterial Spot"}, ${84.90}, ${"High"}, ${"River Plot 2"}, ${"Storm damage and leaf spotting found."}, ${"High"}, ${"Open"}, NOW() - INTERVAL '5 hours')
      `);
    }
  }
}

export async function ensureDatabase() {
  bootstrapPromise ??= (async () => {
    await createTables();
    await seedData();
  })();

  return bootstrapPromise;
}
