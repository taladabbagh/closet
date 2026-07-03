import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Category, CustomField, Tag } from "@/types";
import { parseFilters, countActiveFilters } from "@/features/filters/params";
import { fetchFacets, fetchFilteredItems } from "@/features/filters/query";
import { FilterPanel } from "@/features/filters/components/filter-panel";
import { MobileFilters } from "@/features/filters/components/mobile-filters";
import { WardrobeView } from "@/features/wardrobe/components/wardrobe-view";

export const metadata = { title: "Wardrobe — Closet" };

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const filters = parseFilters(sp);

  const [categoriesRes, fieldsRes, tagsRes, facets] = await Promise.all([
    supabase.from("categories").select("*").order("position").order("name"),
    supabase.from("custom_fields").select("*").order("position").order("name"),
    supabase.from("tags").select("*").order("name"),
    fetchFacets(supabase),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const customFields = (fieldsRes.data ?? []) as CustomField[];
  const tags = (tagsRes.data ?? []) as Tag[];
  const tagNames = tags.map((t) => t.name);

  const items = await fetchFilteredItems(
    supabase,
    filters,
    categories,
    customFields,
  );

  const panel = (
    <FilterPanel
      categories={categories}
      customFields={customFields}
      facets={facets}
      tagNames={tagNames}
    />
  );

  return (
    <div className="flex gap-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1 pb-8">
          <Suspense>{panel}</Suspense>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Wardrobe</h1>
          <div className="lg:hidden">
            <Suspense>
              <MobileFilters activeCount={countActiveFilters(filters)}>
                {panel}
              </MobileFilters>
            </Suspense>
          </div>
        </div>

        <WardrobeView
          userId={user!.id}
          items={items}
          categories={categories}
          customFields={customFields}
          facets={facets}
          tagSuggestions={tagNames}
          hasFilters={countActiveFilters(filters) > 0}
        />
      </div>
    </div>
  );
}
