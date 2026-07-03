import { createClient } from "@/utils/supabase/server";
import { FieldManager } from "@/features/custom-fields/components/field-manager";
import type { CustomField } from "@/types";

export const metadata = { title: "Custom fields — Closet" };

export default async function FieldsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_fields")
    .select("*")
    .order("position")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Custom fields</h1>
      <FieldManager fields={(data ?? []) as CustomField[]} />
    </div>
  );
}
