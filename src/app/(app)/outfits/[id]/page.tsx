import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Category, ItemWithRelations, OutfitWithItems } from "@/types";
import { OutfitBuilder } from "@/features/outfits/components/outfit-builder";

export const metadata = { title: "Edit outfit — Closet" };

const ITEM_SELECT =
  "*, item_images(*), item_tags(tag_id, tags(*)), custom_field_values(*), categories(id, name)";
const OUTFIT_SELECT = `*, outfit_items(*, wardrobe_items(${ITEM_SELECT.replaceAll(" ", "")}))`;

export default async function EditOutfitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [outfitRes, itemsRes, categoriesRes] = await Promise.all([
    supabase.from("outfits").select(OUTFIT_SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("wardrobe_items")
      .select(ITEM_SELECT)
      .eq("is_active", true)
      .order("name"),
    supabase.from("categories").select("*").order("position").order("name"),
  ]);

  if (!outfitRes.data) notFound();

  return (
    <OutfitBuilder
      outfit={outfitRes.data as unknown as OutfitWithItems}
      items={(itemsRes.data ?? []) as unknown as ItemWithRelations[]}
      categories={(categoriesRes.data ?? []) as Category[]}
    />
  );
}
