import { createClient } from "@/utils/supabase/server";
import type { Category, ItemWithRelations } from "@/types";
import { OutfitBuilder } from "@/features/outfits/components/outfit-builder";

export const metadata = { title: "New outfit — Closet" };

const ITEM_SELECT =
  "*, item_images(*), item_tags(tag_id, tags(*)), custom_field_values(*), categories(id, name)";

export default async function NewOutfitPage() {
  const supabase = await createClient();
  const [itemsRes, categoriesRes] = await Promise.all([
    supabase
      .from("wardrobe_items")
      .select(ITEM_SELECT)
      .eq("is_active", true)
      .order("name"),
    supabase.from("categories").select("*").order("position").order("name"),
  ]);

  return (
    <OutfitBuilder
      outfit={null}
      items={(itemsRes.data ?? []) as unknown as ItemWithRelations[]}
      categories={(categoriesRes.data ?? []) as Category[]}
    />
  );
}
