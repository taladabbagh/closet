import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import type { OutfitWithItems } from "@/types";
import { OutfitCard } from "@/features/outfits/components/outfit-card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Outfits — Closet" };

const OUTFIT_SELECT =
  "*, outfit_items(*, wardrobe_items(*, item_images(*), item_tags(tag_id, tags(*)), custom_field_values(*), categories(id, name)))";

export default async function OutfitsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });

  const outfits = (data ?? []) as unknown as OutfitWithItems[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Outfits</h1>
        <Button nativeButton={false} render={<Link href="/outfits/new" />}>
          <Plus className="size-4" /> New outfit
        </Button>
      </div>

      {outfits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-24 text-center">
          <Layers className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No outfits yet</p>
            <p className="text-sm text-muted-foreground">
              Combine your pieces into looks you can reuse.
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/outfits/new" />}
          >
            <Plus className="size-4" /> Build your first outfit
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {outfits.map((o) => (
            <OutfitCard key={o.id} outfit={o} />
          ))}
        </div>
      )}
    </div>
  );
}
