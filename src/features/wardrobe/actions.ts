"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { LaundryStatus } from "@/types";
import { requireUser } from "@/utils/supabase/server";
import { itemInputSchema, type ItemInput, type ItemData } from "./schema";

export type ActionResult = { error?: string; id?: string };

const revalidateWardrobe = () => {
  revalidatePath("/");
  revalidatePath("/outfits");
};

/** Upserts tag names and returns their ids. */
async function resolveTagIds(
  supabase: SupabaseClient,
  user: User,
  names: string[],
): Promise<string[]> {
  if (!names.length) return [];
  const { data, error } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: user.id, name })),
      { onConflict: "user_id,name", ignoreDuplicates: false },
    )
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => t.id as string);
}

/** A custom value counts only if it actually holds something. */
const hasValue = (v: ItemData["custom_values"][number]) =>
  (v.value_text != null && v.value_text !== "") ||
  v.value_number != null ||
  v.value_boolean != null ||
  v.value_options.length > 0;

async function writeChildren(
  supabase: SupabaseClient,
  user: User,
  itemId: string,
  data: ItemData,
) {
  // images
  const { error: imgErr } = await supabase.from("item_images").insert(
    data.images.map((img) => ({
      item_id: itemId,
      path: img.path,
      position: img.position,
    })),
  );
  if (imgErr) throw new Error(imgErr.message);

  // tags
  const tagIds = await resolveTagIds(supabase, user, data.tags);
  if (tagIds.length) {
    const { error } = await supabase
      .from("item_tags")
      .insert(tagIds.map((tag_id) => ({ item_id: itemId, tag_id })));
    if (error) throw new Error(error.message);
  }

  // custom field values
  const values = data.custom_values.filter(hasValue);
  if (values.length) {
    const { error } = await supabase.from("custom_field_values").insert(
      values.map((v) => ({
        item_id: itemId,
        field_id: v.field_id,
        value_text: v.value_text ?? null,
        value_number: v.value_number ?? null,
        value_boolean: v.value_boolean ?? null,
        value_options: v.value_options,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

const itemColumns = (d: ItemData) => ({
  name: d.name,
  notes: d.notes || null,
  category_id: d.category_id ?? null,
  colors: d.colors,
  brand: d.brand || null,
  seasons: d.seasons,
  occasions: d.occasions,
  style: d.style || null,
  materials: d.materials,
  fit: d.fit || null,
  pattern: d.pattern || null,
  price: d.price ?? null,
  purchase_date: d.purchase_date || null,
  laundry_status: d.laundry_status,
  is_favorite: d.is_favorite,
  is_active: d.is_active,
});

export async function createItem(input: ItemInput): Promise<ActionResult> {
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { supabase, user } = await requireUser();
    const { data: item, error } = await supabase
      .from("wardrobe_items")
      .insert({ ...itemColumns(parsed.data), user_id: user.id })
      .select("id")
      .single();
    if (error) return { error: error.message };

    await writeChildren(supabase, user, item.id, parsed.data);
    revalidateWardrobe();
    return { id: item.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function updateItem(
  id: string,
  input: ItemInput,
): Promise<ActionResult> {
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { supabase, user } = await requireUser();

    const { error } = await supabase
      .from("wardrobe_items")
      .update(itemColumns(parsed.data))
      .eq("id", id);
    if (error) return { error: error.message };

    // Replace children wholesale (simple + consistent). Remove storage
    // objects whose image rows are being dropped.
    const { data: oldImages } = await supabase
      .from("item_images")
      .select("path")
      .eq("item_id", id);
    const keep = new Set(parsed.data.images.map((i) => i.path));
    const orphans = (oldImages ?? [])
      .map((i) => i.path as string)
      .filter((p) => !keep.has(p));
    if (orphans.length) {
      await supabase.storage.from("wardrobe").remove(orphans);
    }

    for (const table of [
      "item_images",
      "item_tags",
      "custom_field_values",
    ] as const) {
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .eq("item_id", id);
      if (delErr) return { error: delErr.message };
    }

    await writeChildren(supabase, user, id, parsed.data);
    revalidateWardrobe();
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: images } = await supabase
    .from("item_images")
    .select("path")
    .eq("item_id", id);
  if (images?.length) {
    await supabase.storage
      .from("wardrobe")
      .remove(images.map((i) => i.path as string));
  }

  const { error } = await supabase
    .from("wardrobe_items")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateWardrobe();
  return {};
}

export async function toggleFavorite(
  id: string,
  value: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("wardrobe_items")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateWardrobe();
  return {};
}

export async function setLaundryStatus(
  id: string,
  status: LaundryStatus,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("wardrobe_items")
    .update({ laundry_status: status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateWardrobe();
  return {};
}

/** "I wore this today" — bumps wear count and marks it dirty. */
export async function markWorn(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: item, error: readErr } = await supabase
    .from("wardrobe_items")
    .select("wear_count")
    .eq("id", id)
    .single();
  if (readErr) return { error: readErr.message };

  const { error } = await supabase
    .from("wardrobe_items")
    .update({
      wear_count: (item.wear_count as number) + 1,
      last_worn_at: new Date().toISOString(),
      laundry_status: "DIRTY",
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateWardrobe();
  return {};
}
