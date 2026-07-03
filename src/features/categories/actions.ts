"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/utils/supabase/server";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  icon: z.string().trim().max(40).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
});

export type ActionResult = { error?: string };

export async function createCategory(
  input: z.infer<typeof categorySchema>,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("categories").insert({
    ...parsed.data,
    icon: parsed.data.icon || null,
    color: parsed.data.color || null,
    parent_id: parsed.data.parent_id ?? null,
    user_id: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/");
  return {};
}

export async function updateCategory(
  id: string,
  input: z.infer<typeof categorySchema>,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.parent_id === id)
    return { error: "A category cannot be its own parent" };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      icon: parsed.data.icon || null,
      color: parsed.data.color || null,
      parent_id: parsed.data.parent_id ?? null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/");
  return {};
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  // Cascades to child categories; items keep existing (category_id -> null).
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/categories");
  revalidatePath("/");
  return {};
}
