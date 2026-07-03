// URL <-> filter state. Filters live in searchParams so views are
// shareable, bookmarkable, and always rendered server-side.

import type { LaundryStatus, Season } from "@/types";

export interface CustomFieldFilter {
  fieldId: string;
  text?: string; // TEXT: contains
  min?: number; // NUMBER
  max?: number; // NUMBER
  boolean?: boolean; // BOOLEAN
  options?: string[]; // SELECT / MULTI_SELECT: any-of
}

export interface FilterState {
  q?: string;
  categoryId?: string; // includes descendants
  colors: string[];
  brands: string[];
  seasons: Season[];
  occasions: string[];
  styles: string[];
  materials: string[];
  fits: string[];
  patterns: string[];
  tags: string[]; // tag names
  priceMin?: number;
  priceMax?: number;
  wearMin?: number;
  wearMax?: number;
  laundry: LaundryStatus[];
  favorite?: boolean;
  includeInactive?: boolean;
  cf: CustomFieldFilter[];
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const csv = (v: string | string[] | undefined): string[] => {
  const s = first(v);
  return s ? s.split(",").map(decodeURIComponent).filter(Boolean) : [];
};

const num = (v: string | string[] | undefined): number | undefined => {
  const s = first(v);
  if (s === undefined || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export function parseFilters(sp: RawSearchParams): FilterState {
  const cf: CustomFieldFilter[] = [];
  for (const [key, value] of Object.entries(sp)) {
    const m = key.match(/^cf_([0-9a-f-]{36})(?:_(min|max|bool))?$/);
    if (!m) continue;
    const fieldId = m[1];
    let f = cf.find((x) => x.fieldId === fieldId);
    if (!f) {
      f = { fieldId };
      cf.push(f);
    }
    if (m[2] === "min") f.min = num(value);
    else if (m[2] === "max") f.max = num(value);
    else if (m[2] === "bool") f.boolean = first(value) === "1";
    else {
      // plain: either text or option list (comma separated)
      const vals = csv(value);
      if (vals.length > 1) f.options = vals;
      else if (vals.length === 1) {
        f.text = vals[0];
        f.options = vals;
      }
    }
  }

  return {
    q: first(sp.q)?.trim() || undefined,
    categoryId: first(sp.category) || undefined,
    colors: csv(sp.colors),
    brands: csv(sp.brands),
    seasons: csv(sp.seasons) as Season[],
    occasions: csv(sp.occasions),
    styles: csv(sp.styles),
    materials: csv(sp.materials),
    fits: csv(sp.fits),
    patterns: csv(sp.patterns),
    tags: csv(sp.tags),
    priceMin: num(sp.price_min),
    priceMax: num(sp.price_max),
    wearMin: num(sp.wear_min),
    wearMax: num(sp.wear_max),
    laundry: csv(sp.laundry) as LaundryStatus[],
    favorite: first(sp.favorite) === "1" || undefined,
    includeInactive: first(sp.inactive) === "1" || undefined,
    cf,
  };
}

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.q) n++;
  if (f.categoryId) n++;
  n += [
    f.colors,
    f.brands,
    f.seasons,
    f.occasions,
    f.styles,
    f.materials,
    f.fits,
    f.patterns,
    f.tags,
    f.laundry,
  ].filter((a) => a.length > 0).length;
  if (f.priceMin !== undefined || f.priceMax !== undefined) n++;
  if (f.wearMin !== undefined || f.wearMax !== undefined) n++;
  if (f.favorite) n++;
  if (f.includeInactive) n++;
  n += f.cf.filter(
    (c) =>
      c.text ||
      c.options?.length ||
      c.boolean !== undefined ||
      c.min !== undefined ||
      c.max !== undefined,
  ).length;
  return n;
}
