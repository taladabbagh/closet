// Domain row types mirroring supabase/schema.sql.

export const SEASONS = [
  "SPRING",
  "SUMMER",
  "FALL",
  "WINTER",
  "ALL_SEASON",
] as const;
export type Season = (typeof SEASONS)[number];

export const LAUNDRY_STATUSES = ["CLEAN", "DIRTY", "IN_LAUNDRY"] as const;
export type LaundryStatus = (typeof LAUNDRY_STATUSES)[number];

export const CUSTOM_FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  category_id: string | null;
  colors: string[];
  brand: string | null;
  seasons: Season[];
  occasions: string[];
  style: string | null;
  materials: string[];
  fit: string | null;
  pattern: string | null;
  price: number | null;
  wear_count: number;
  last_worn_at: string | null;
  laundry_status: LaundryStatus;
  is_favorite: boolean;
  is_active: boolean;
  purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemImage {
  id: string;
  item_id: string;
  path: string;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface CustomField {
  id: string;
  user_id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  field_id: string;
  item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_options: string[];
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  item_id: string;
  slot_category_id: string | null;
  position: number;
}

// --- common joined shapes ---

export interface ItemWithRelations extends WardrobeItem {
  item_images: ItemImage[];
  item_tags: { tag_id: string; tags: Tag }[];
  custom_field_values: CustomFieldValue[];
  categories: Pick<Category, "id" | "name"> | null;
}

export interface OutfitWithItems extends Outfit {
  outfit_items: (OutfitItem & { wardrobe_items: ItemWithRelations | null })[];
}
