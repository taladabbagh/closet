"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CUSTOM_FIELD_TYPES } from "@/types";
import { requireUser } from "@/utils/supabase/server";

const fieldSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    type: z.enum(CUSTOM_FIELD_TYPES),
    options: z.array(z.string().trim().min(1)).max(50).default([]),
  })
  .refine(
    (f) =>
      !["SELECT", "MULTI_SELECT"].includes(f.type) || f.options.length > 0,
    { message: "Add at least one option" },
  );

export type ActionResult = { error?: string };

export async function createCustomField(input: {
  name: string;
  type: string;
  options: string[];
}): Promise<ActionResult> {
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("custom_fields").insert({
    ...parsed.data,
    user_id: user.id,
  });
  if (error)
    return {
      error: error.code === "23505" ? "A field with that name exists" : error.message,
    };

  revalidatePath("/fields");
  revalidatePath("/");
  return {};
}

export async function updateCustomField(
  id: string,
  input: { name: string; type: string; options: string[] },
): Promise<ActionResult> {
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("custom_fields")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/fields");
  revalidatePath("/");
  return {};
}

export async function deleteCustomField(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("custom_fields").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/fields");
  revalidatePath("/");
  return {};
}
