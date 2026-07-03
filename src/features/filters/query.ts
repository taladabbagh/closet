// Server-side filtering engine. All filters compose with AND logic;
// selections within one field match with OR (e.g. colors: red OR blue).
// Custom-field and tag filters resolve to item-id sets first, then the
// main query intersects them — everything stays parameterized Supabase
// queries, no raw SQL from user input.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Category,
  CustomField,
  ItemWithRelations,
} from "@/types";
import { buildCategoryTree, subtreeIds } from "@/features/categories/tree";
import type { CustomFieldFilter, FilterState } from "./params";

const ITEM_SELECT =
  "*, item_images(*), item_tags(tag_id, tags(*)), custom_field_values(*), categories(id, name)";

/** Escape %/_ in user input used inside ilike patterns. */
const likeEscape = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);

async function itemIdsMatchingCustomField(
  supabase: SupabaseClient,
  filter: CustomFieldFilter,
  field: CustomField | undefined,
): Promise<Set<string> | null> {
  if (!field) return null;

  let q = supabase
    .from("custom_field_values")
    .select("item_id")
    .eq("field_id", filter.fieldId);

  switch (field.type) {
    case "TEXT":
      if (!filter.text) return null;
      q = q.ilike("value_text", `%${likeEscape(filter.text)}%`);
      break;
    case "NUMBER": {
      if (filter.min === undefined && filter.max === undefined) return null;
      if (filter.min !== undefined) q = q.gte("value_number", filter.min);
      if (filter.max !== undefined) q = q.lte("value_number", filter.max);
      break;
    }
    case "BOOLEAN":
      if (filter.boolean === undefined) return null;
      q = q.eq("value_boolean", filter.boolean);
      break;
    case "SELECT":
    case "MULTI_SELECT": {
      if (!filter.options?.length) return null;
      q = q.overlaps("value_options", filter.options);
      break;
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.item_id as string));
}

async function itemIdsMatchingTags(
  supabase: SupabaseClient,
  tagNames: string[],
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("item_tags")
    .select("item_id, tags!inner(name)")
    .in("tags.name", tagNames);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.item_id as string));
}

export async function fetchFilteredItems(
  supabase: SupabaseClient,
  filters: FilterState,
  categories: Category[],
  customFields: CustomField[],
): Promise<ItemWithRelations[]> {
  // 1. Resolve id-set constraints (custom fields AND tags).
  const idSets: Set<string>[] = [];

  for (const cff of filters.cf) {
    const set = await itemIdsMatchingCustomField(
      supabase,
      cff,
      customFields.find((f) => f.id === cff.fieldId),
    );
    if (set) idSets.push(set);
  }

  if (filters.tags.length > 0) {
    idSets.push(await itemIdsMatchingTags(supabase, filters.tags));
  }

  let allowedIds: string[] | null = null;
  if (idSets.length > 0) {
    const intersection = idSets.reduce((acc, s) => {
      return new Set([...acc].filter((id) => s.has(id)));
    });
    if (intersection.size === 0) return [];
    allowedIds = [...intersection];
  }

  // 2. Main query with system filters.
  let q = supabase.from("wardrobe_items").select(ITEM_SELECT);

  if (allowedIds) q = q.in("id", allowedIds);

  if (!filters.includeInactive) q = q.eq("is_active", true);
  if (filters.favorite) q = q.eq("is_favorite", true);

  if (filters.q) {
    const term = `%${likeEscape(filters.q)}%`;
    q = q.or(`name.ilike.${term},brand.ilike.${term},notes.ilike.${term}`);
  }

  if (filters.categoryId) {
    const tree = buildCategoryTree(categories);
    const findNode = (nodes: typeof tree): (typeof tree)[number] | null => {
      for (const n of nodes) {
        if (n.id === filters.categoryId) return n;
        const hit = findNode(n.children);
        if (hit) return hit;
      }
      return null;
    };
    const node = findNode(tree);
    q = q.in(
      "category_id",
      node ? subtreeIds(node) : [filters.categoryId],
    );
  }

  if (filters.colors.length) q = q.overlaps("colors", filters.colors);
  if (filters.seasons.length) q = q.overlaps("seasons", filters.seasons);
  if (filters.occasions.length) q = q.overlaps("occasions", filters.occasions);
  if (filters.materials.length) q = q.overlaps("materials", filters.materials);
  if (filters.brands.length) q = q.in("brand", filters.brands);
  if (filters.styles.length) q = q.in("style", filters.styles);
  if (filters.fits.length) q = q.in("fit", filters.fits);
  if (filters.patterns.length) q = q.in("pattern", filters.patterns);
  if (filters.laundry.length) q = q.in("laundry_status", filters.laundry);

  if (filters.priceMin !== undefined) q = q.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) q = q.lte("price", filters.priceMax);
  if (filters.wearMin !== undefined) q = q.gte("wear_count", filters.wearMin);
  if (filters.wearMax !== undefined) q = q.lte("wear_count", filters.wearMax);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ItemWithRelations[];
}

/** Distinct facet values across the user's wardrobe, for filter options. */
export interface Facets {
  colors: string[];
  brands: string[];
  occasions: string[];
  styles: string[];
  materials: string[];
  fits: string[];
  patterns: string[];
}

export async function fetchFacets(supabase: SupabaseClient): Promise<Facets> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("colors, brand, occasions, style, materials, fit, pattern");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const distinct = (vals: (string | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b),
    );

  return {
    colors: distinct(rows.flatMap((r) => r.colors ?? [])),
    brands: distinct(rows.map((r) => r.brand)),
    occasions: distinct(rows.flatMap((r) => r.occasions ?? [])),
    styles: distinct(rows.map((r) => r.style)),
    materials: distinct(rows.flatMap((r) => r.materials ?? [])),
    fits: distinct(rows.map((r) => r.fit)),
    patterns: distinct(rows.map((r) => r.pattern)),
  };
}
