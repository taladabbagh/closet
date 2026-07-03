import { z } from "zod";
import { LAUNDRY_STATUSES, SEASONS } from "@/types";

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),

  colors: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  brand: z.string().trim().max(80).optional().nullable(),
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  style: z.string().trim().max(60).optional().nullable(),
  materials: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  fit: z.string().trim().max(60).optional().nullable(),
  pattern: z.string().trim().max(60).optional().nullable(),
  price: z.number().nonnegative().max(9_999_999).optional().nullable(),
  purchase_date: z.string().date().optional().nullable(),
  laundry_status: z.enum(LAUNDRY_STATUSES).default("CLEAN"),
  is_favorite: z.boolean().default(false),
  is_active: z.boolean().default(true),

  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  images: z
    .array(z.object({ path: z.string().min(1), position: z.number().int() }))
    .max(12)
    .default([]),
  custom_values: z
    .array(
      z.object({
        field_id: z.string().uuid(),
        value_text: z.string().max(2000).optional().nullable(),
        value_number: z.number().optional().nullable(),
        value_boolean: z.boolean().optional().nullable(),
        value_options: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export type ItemInput = z.input<typeof itemInputSchema>;
export type ItemData = z.output<typeof itemInputSchema>;
