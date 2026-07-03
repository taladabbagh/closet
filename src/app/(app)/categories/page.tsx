import { createClient } from "@/utils/supabase/server";
import { CategoryManager } from "@/features/categories/components/category-manager";
import type { Category } from "@/types";

export const metadata = { title: "Categories — Closet" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("position")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <CategoryManager categories={(data ?? []) as Category[]} />
    </div>
  );
}
