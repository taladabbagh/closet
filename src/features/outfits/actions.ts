"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/utils/supabase/server";

const outfitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_favorite: z.boolean().default(false),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        slot_category_id: z.string().uuid().nullable(),
        position: z.number().int(),
      }),
    )
    .min(1, "Pick at least one item"),
});

export type OutfitInput = z.input<typeof outfitSchema>;
export type ActionResult = { error?: string; id?: string };

export async function saveOutfit(
  outfitId: string | null,
  input: OutfitInput,
): Promise<ActionResult> {
  const parsed = outfitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { items, ...outfit } = parsed.data;

  const { supabase, user } = await requireUser();

  let id = outfitId;
  if (id) {
    const { error } = await supabase
      .from("outfits")
      .update({ ...outfit, notes: outfit.notes || null })
      .eq("id", id);
    if (error) return { error: error.message };
    const { error: delErr } = await supabase
      .from("outfit_items")
      .delete()
      .eq("outfit_id", id);
    if (delErr) return { error: delErr.message };
  } else {
    const { data, error } = await supabase
      .from("outfits")
      .insert({ ...outfit, notes: outfit.notes || null, user_id: user.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    id = data.id as string;
  }

  const { error: itemsErr } = await supabase
    .from("outfit_items")
    .insert(items.map((it) => ({ ...it, outfit_id: id })));
  if (itemsErr) return { error: itemsErr.message };

  revalidatePath("/outfits");
  return { id };
}

export async function deleteOutfit(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("outfits").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/outfits");
  return {};
}

export async function toggleOutfitFavorite(
  id: string,
  value: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("outfits")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/outfits");
  return {};
}

export async function duplicateOutfit(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { data: source, error: readErr } = await supabase
    .from("outfits")
    .select("*, outfit_items(*)")
    .eq("id", id)
    .single();
  if (readErr) return { error: readErr.message };

  const { data: copy, error: insErr } = await supabase
    .from("outfits")
    .insert({
      name: `${source.name} (copy)`,
      notes: source.notes,
      is_favorite: false,
      user_id: user.id,
    })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };

  const items = (source.outfit_items ?? []) as {
    item_id: string;
    slot_category_id: string | null;
    position: number;
  }[];
  if (items.length) {
    const { error } = await supabase.from("outfit_items").insert(
      items.map((it) => ({
        outfit_id: copy.id,
        item_id: it.item_id,
        slot_category_id: it.slot_category_id,
        position: it.position,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/outfits");
  return { id: copy.id as string };
}
