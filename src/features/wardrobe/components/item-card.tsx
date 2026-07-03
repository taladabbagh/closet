"use client";

import Image from "next/image";
import { Heart, Shirt } from "lucide-react";
import type { ItemWithRelations } from "@/types";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const LAUNDRY_BADGE: Record<string, { label: string; className: string }> = {
  DIRTY: { label: "Dirty", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  IN_LAUNDRY: { label: "In laundry", className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
};

export function ItemCard({
  item,
  onOpen,
  onToggleFavorite,
}: {
  item: ItemWithRelations;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const cover = item.item_images
    .slice()
    .sort((a, b) => a.position - b.position)[0];
  const laundry = LAUNDRY_BADGE[item.laundry_status];

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        !item.is_active && "opacity-55",
      )}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      <div className="relative aspect-square bg-muted">
        {cover ? (
          <Image
            src={imageUrl(cover.path)}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <Shirt className="size-10" />
          </div>
        )}

        <button
          type="button"
          aria-label={item.is_favorite ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 shadow-sm backdrop-blur transition-transform hover:scale-110"
        >
          <Heart
            className={cn(
              "size-4",
              item.is_favorite
                ? "fill-rose-500 text-rose-500"
                : "text-muted-foreground",
            )}
          />
        </button>

        {laundry && (
          <span
            className={cn(
              "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur",
              laundry.className,
            )}
          >
            {laundry.label}
          </span>
        )}
      </div>

      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.brand && <span className="truncate">{item.brand}</span>}
          {item.brand && item.categories && <span>·</span>}
          {item.categories && (
            <span className="truncate">{item.categories.name}</span>
          )}
        </div>
        {(item.wear_count > 0 || item.item_tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {item.wear_count > 0 && (
              <Badge variant="outline" className="text-[10px]">
                Worn {item.wear_count}×
              </Badge>
            )}
            {item.item_tags.slice(0, 2).map((t) => (
              <Badge key={t.tag_id} variant="secondary" className="text-[10px]">
                {t.tags.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
