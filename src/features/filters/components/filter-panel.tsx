"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Category, CustomField } from "@/types";
import { LAUNDRY_STATUSES, SEASONS } from "@/types";
import { buildCategoryTree, flattenTree } from "@/features/categories/tree";
import type { Facets } from "@/features/filters/query";
import { countActiveFilters, parseFilters } from "@/features/filters/params";
import { MultiToggle } from "@/components/multi-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const ALL = "__all__";

const SEASON_LABELS = {
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
  WINTER: "Winter",
  ALL_SEASON: "All season",
} as const;

const LAUNDRY_LABELS = {
  CLEAN: "Clean",
  DIRTY: "Dirty",
  IN_LAUNDRY: "In laundry",
} as const;

export function FilterPanel({
  categories,
  customFields,
  facets,
  tagNames,
}: {
  categories: Category[];
  customFields: CustomField[];
  facets: Facets;
  tagNames: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
  const activeCount = countActiveFilters(filters);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const setCsv = (key: string, values: string[]) =>
    setParams({
      [key]: values.length ? values.map(encodeURIComponent).join(",") : null,
    });

  // debounced search
  const [q, setQ] = useState(filters.q ?? "");
  useEffect(() => setQ(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q.trim()) setParams({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const categoryRows = useMemo(
    () => flattenTree(buildCategoryTree(categories)),
    [categories],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace(pathname, { scroll: false })}
          >
            <X className="size-3.5" /> Clear ({activeCount})
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, brand, notes…"
          className="pl-8"
        />
      </div>

      <FilterSection label="Category">
        <Select
          value={filters.categoryId ?? ALL}
          onValueChange={(v) => setParams({ category: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categoryRows.map(({ node, depth }) => (
              <SelectItem key={node.id} value={node.id}>
                {"— ".repeat(depth)}
                {node.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="Quick">
        <div className="space-y-2.5">
          <label className="flex items-center justify-between text-sm">
            Favorites only
            <Switch
              checked={!!filters.favorite}
              onCheckedChange={(v) => setParams({ favorite: v ? "1" : null })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Include inactive
            <Switch
              checked={!!filters.includeInactive}
              onCheckedChange={(v) => setParams({ inactive: v ? "1" : null })}
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection label="Seasons">
        <MultiToggle
          options={SEASONS}
          value={filters.seasons}
          onChange={(v) => setCsv("seasons", v)}
          labels={SEASON_LABELS}
        />
      </FilterSection>

      <FilterSection label="Laundry">
        <MultiToggle
          options={LAUNDRY_STATUSES}
          value={filters.laundry}
          onChange={(v) => setCsv("laundry", v)}
          labels={LAUNDRY_LABELS}
        />
      </FilterSection>

      <CheckboxSection
        label="Colors"
        options={facets.colors}
        selected={filters.colors}
        onChange={(v) => setCsv("colors", v)}
      />
      <CheckboxSection
        label="Brands"
        options={facets.brands}
        selected={filters.brands}
        onChange={(v) => setCsv("brands", v)}
      />
      <CheckboxSection
        label="Occasions"
        options={facets.occasions}
        selected={filters.occasions}
        onChange={(v) => setCsv("occasions", v)}
      />
      <CheckboxSection
        label="Styles"
        options={facets.styles}
        selected={filters.styles}
        onChange={(v) => setCsv("styles", v)}
      />
      <CheckboxSection
        label="Materials"
        options={facets.materials}
        selected={filters.materials}
        onChange={(v) => setCsv("materials", v)}
      />
      <CheckboxSection
        label="Fits"
        options={facets.fits}
        selected={filters.fits}
        onChange={(v) => setCsv("fits", v)}
      />
      <CheckboxSection
        label="Patterns"
        options={facets.patterns}
        selected={filters.patterns}
        onChange={(v) => setCsv("patterns", v)}
      />
      <CheckboxSection
        label="Tags"
        options={tagNames}
        selected={filters.tags}
        onChange={(v) => setCsv("tags", v)}
      />

      <FilterSection label="Price">
        <RangeInputs
          min={filters.priceMin}
          max={filters.priceMax}
          onChange={(min, max) =>
            setParams({ price_min: min, price_max: max })
          }
        />
      </FilterSection>

      <FilterSection label="Wear count">
        <RangeInputs
          min={filters.wearMin}
          max={filters.wearMax}
          onChange={(min, max) => setParams({ wear_min: min, wear_max: max })}
        />
      </FilterSection>

      {customFields.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom fields
          </p>
          {customFields.map((field) => (
            <CustomFieldFilterControl
              key={field.id}
              field={field}
              filters={filters}
              setParams={setParams}
              setCsv={setCsv}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function CheckboxSection({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const visible = expanded ? options : options.slice(0, 6);

  return (
    <FilterSection label={label}>
      <div className="space-y-1.5">
        {visible.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) =>
                  onChange(
                    v === true
                      ? [...selected, opt]
                      : selected.filter((x) => x !== opt),
                  )
                }
              />
              <span className="truncate">{opt}</span>
            </label>
          );
        })}
        {options.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Show less" : `Show all ${options.length}`}
          </button>
        )}
      </div>
    </FilterSection>
  );
}

function RangeInputs({
  min,
  max,
  onChange,
}: {
  min?: number;
  max?: number;
  onChange: (min: string | null, max: string | null) => void;
}) {
  const [lo, setLo] = useState(min?.toString() ?? "");
  const [hi, setHi] = useState(max?.toString() ?? "");

  useEffect(() => setLo(min?.toString() ?? ""), [min]);
  useEffect(() => setHi(max?.toString() ?? ""), [max]);

  const commit = () => onChange(lo || null, hi || null);

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="Min"
        value={lo}
        onChange={(e) => setLo(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="number"
        placeholder="Max"
        value={hi}
        onChange={(e) => setHi(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}

function CustomFieldFilterControl({
  field,
  filters,
  setParams,
  setCsv,
}: {
  field: CustomField;
  filters: ReturnType<typeof parseFilters>;
  setParams: (patch: Record<string, string | null>) => void;
  setCsv: (key: string, values: string[]) => void;
}) {
  const current = filters.cf.find((c) => c.fieldId === field.id);
  const key = `cf_${field.id}`;

  const [text, setText] = useState(current?.text ?? "");
  useEffect(() => setText(current?.text ?? ""), [current?.text]);

  switch (field.type) {
    case "TEXT":
      return (
        <FilterSection label={field.name}>
          <Input
            value={text}
            placeholder="Contains…"
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setParams({ [key]: text.trim() || null })}
            onKeyDown={(e) =>
              e.key === "Enter" && setParams({ [key]: text.trim() || null })
            }
          />
        </FilterSection>
      );
    case "NUMBER":
      return (
        <FilterSection label={field.name}>
          <RangeInputs
            min={current?.min}
            max={current?.max}
            onChange={(min, max) =>
              setParams({ [`${key}_min`]: min, [`${key}_max`]: max })
            }
          />
        </FilterSection>
      );
    case "BOOLEAN":
      return (
        <FilterSection label={field.name}>
          <label className="flex items-center justify-between text-sm">
            Yes
            <Switch
              checked={current?.boolean === true}
              onCheckedChange={(v) =>
                setParams({ [`${key}_bool`]: v ? "1" : null })
              }
            />
          </label>
        </FilterSection>
      );
    case "SELECT":
    case "MULTI_SELECT": {
      const selected = current?.options ?? [];
      return (
        <FilterSection label={field.name}>
          <div className="space-y-1.5">
            {field.options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(v) =>
                    setCsv(
                      key,
                      v === true
                        ? [...selected, opt]
                        : selected.filter((x) => x !== opt),
                    )
                  }
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      );
    }
  }
}
