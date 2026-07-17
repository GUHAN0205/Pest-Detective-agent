import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 24 }).notNull().default("farmer"),
    farmName: varchar("farm_name", { length: 160 }),
    location: varchar("location", { length: 180 }),
    preferredLanguage: varchar("preferred_language", { length: 24 }).notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email), index("users_role_idx").on(table.role)],
);

export const diseases = pgTable(
  "diseases",
  {
    id: serial("id").primaryKey(),
    crop: varchar("crop", { length: 80 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    severityDefault: varchar("severity_default", { length: 32 }).notNull().default("Medium"),
    description: text("description").notNull(),
    symptoms: text("symptoms").notNull(),
    cause: text("cause").notNull(),
    riskFactors: text("risk_factors").notNull(),
    imageHints: text("image_hints"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("diseases_slug_unique").on(table.slug),
    index("diseases_crop_idx").on(table.crop),
    index("diseases_name_idx").on(table.name),
  ],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    diseaseId: integer("disease_id")
      .notNull()
      .references(() => diseases.id, { onDelete: "cascade" }),
    organicTreatment: text("organic_treatment").notNull(),
    chemicalTreatment: text("chemical_treatment").notNull(),
    preventionTips: text("prevention_tips").notNull(),
    scoutingTips: text("scouting_tips").notNull(),
    weatherRisk: text("weather_risk").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("recommendations_disease_unique").on(table.diseaseId)],
);

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    diseaseId: integer("disease_id").references(() => diseases.id, { onDelete: "set null" }),
    imagePath: text("image_path").notNull(),
    crop: varchar("crop", { length: 80 }).notNull(),
    prediction: varchar("prediction", { length: 160 }).notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
    severity: varchar("severity", { length: 32 }).notNull(),
    fieldLocation: varchar("field_location", { length: 180 }),
    notes: text("notes"),
    weatherRisk: varchar("weather_risk", { length: 32 }).notNull().default("Medium"),
    status: varchar("status", { length: 32 }).notNull().default("Open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("predictions_user_idx").on(table.userId),
    index("predictions_disease_idx").on(table.diseaseId),
    index("predictions_created_idx").on(table.createdAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  predictions: many(predictions),
}));

export const diseasesRelations = relations(diseases, ({ many, one }) => ({
  predictions: many(predictions),
  recommendation: one(recommendations, {
    fields: [diseases.id],
    references: [recommendations.diseaseId],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  disease: one(diseases, {
    fields: [recommendations.diseaseId],
    references: [diseases.id],
  }),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  user: one(users, {
    fields: [predictions.userId],
    references: [users.id],
  }),
  disease: one(diseases, {
    fields: [predictions.diseaseId],
    references: [diseases.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Disease = typeof diseases.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
