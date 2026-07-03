"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Copy, Heart, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { OutfitWithItems } from "@/types";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import {
  deleteOutfit,
  duplicateOutfit,
  toggleOutfitFavorite,
} from "@/features/outfits/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OutfitCard({ outfit }: { outfit: OutfitWithItems }) {
  const [pending, startTransition] = useTransition();

  const covers = outfit.outfit_items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((oi) => {
      const item = oi.wardrobe_items;
      const img = item?.item_images
        ?.slice()
        .sort((a, b) => a.position - b.position)[0];
      return img ? { path: img.path, name: item!.name } : null;
    })
    .filter(Boolean) as { path: string; name: string }[];

  return (
    <div className="group relative overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/outfits/${outfit.id}`} className="block">
        <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-muted">
          {covers.length === 0 ? (
            <div className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground/40">
              <Layers className="size-10" />
            </div>
          ) : (
            covers.slice(0, 4).map((c, i) => (
              <div
                key={`${c.path}-${i}`}
                className={cn(
                  "relative",
                  covers.length === 1 && "col-span-2 row-span-2",
                  covers.length === 2 && "row-span-2",
                  covers.length === 3 && i === 0 && "row-span-2",
                )}
              >
                <Image
                  src={imageUrl(c.path)}
                  alt={c.name}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))
          )}
        </div>
      </Link>

      <button
        type="button"
        aria-label={outfit.is_favorite ? "Unfavorite" : "Favorite"}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleOutfitFavorite(
              outfit.id,
              !outfit.is_favorite,
            );
            if (res.error) toast.error(res.error);
          })
        }
        className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 shadow-sm backdrop-blur transition-transform hover:scale-110"
      >
        <Heart
          className={cn(
            "size-4",
            outfit.is_favorite
              ? "fill-rose-500 text-rose-500"
              : "text-muted-foreground",
          )}
        />
      </button>

      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{outfit.name}</p>
          <p className="text-xs text-muted-foreground">
            {outfit.outfit_items.length} piece
            {outfit.outfit_items.length === 1 ? "" : "s"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Outfit menu">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={
                <Link href={`/outfits/${outfit.id}`}>
                  <Pencil className="size-3.5" /> Edit
                </Link>
              }
            />
            <DropdownMenuItem
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await duplicateOutfit(outfit.id);
                  if (res.error) toast.error(res.error);
                  else toast.success("Outfit duplicated");
                })
              }
            >
              <Copy className="size-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteOutfit(outfit.id);
                  if (res.error) toast.error(res.error);
                  else toast.success("Outfit deleted");
                })
              }
            >
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
