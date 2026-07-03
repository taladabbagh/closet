"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Plus } from "lucide-react";
import type { ItemImage, ItemWithRelations } from "@/types";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { SectionKey } from "@/features/outfits/sections";

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;
const WHEEL_COOLDOWN_MS = 320;

const spring = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;

const slide = {
  enter: (dir: number) => ({ x: dir * 96, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -96, opacity: 0, scale: 0.94 }),
};

const fade = {
  enter: () => ({ opacity: 0 }),
  center: { opacity: 1 },
  exit: () => ({ opacity: 0 }),
};

export function coverOf(item: ItemWithRelations): ItemImage | undefined {
  return item.item_images.slice().sort((a, b) => a.position - b.position)[0];
}

export function SectionCarousel({
  section,
  label,
  items,
  index,
  direction,
  active,
  isFavorite,
  onStep,
  onActivate,
  onToggleFavorite,
}: {
  section: SectionKey;
  label: string;
  items: ItemWithRelations[];
  index: number;
  direction: 1 | -1;
  active: boolean;
  isFavorite: (item: ItemWithRelations) => boolean;
  onStep: (dir: 1 | -1) => void;
  onActivate: () => void;
  onToggleFavorite: (item: ItemWithRelations) => void;
}) {
  const reducedMotion = useReducedMotion();
  const wheelLock = useRef(0);
  const item = index >= 0 ? items[index] : undefined;

  // warm the cache for neighbors so browsing never waits on the network
  useEffect(() => {
    if (index < 0 || items.length < 2) return;
    const urls = new Set<string>();
    for (const offset of [1, -1, 2, -2]) {
      const neighbor =
        items[(index + offset + items.length * 2) % items.length];
      const cover = coverOf(neighbor);
      if (cover) urls.add(imageUrl(cover.path));
    }
    for (const src of urls) {
      const img = new window.Image();
      img.src = src;
    }
  }, [index, items]);

  const handleWheel = (e: React.WheelEvent) => {
    if (items.length < 2) return;
    // only react to clearly horizontal intent (trackpads, tilt wheels)
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12)
      return;
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_COOLDOWN_MS) return;
    wheelLock.current = now;
    onStep(e.deltaX > 0 ? 1 : -1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onPointerDown={onActivate}
      onFocusCapture={onActivate}
      className="w-full"
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </h2>
        {items.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {index + 1} / {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex h-[clamp(8.5rem,22vh,13rem)] flex-col items-center justify-center gap-2 rounded-[1.75rem] border border-dashed border-border/80 bg-muted/30 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No {label.toLowerCase()}s yet
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
          >
            <Plus className="size-3" /> Add to wardrobe
          </Link>
        </div>
      ) : (
        <div
          onWheel={handleWheel}
          className={cn(
            "group/section relative overflow-hidden rounded-[1.75rem] border bg-card/70 shadow-[0_8px_32px_-12px_rgb(0_0_0/0.14)] backdrop-blur-xl transition-shadow duration-300",
            active &&
              "shadow-[0_12px_40px_-12px_rgb(0_0_0/0.2)] ring-1 ring-foreground/10",
          )}
        >
          <div className="relative h-[clamp(8.5rem,22vh,13rem)] touch-pan-y">
            <AnimatePresence
              initial={false}
              custom={direction}
              mode="popLayout"
            >
              {item && (
                <motion.div
                  key={item.id}
                  custom={direction}
                  variants={reducedMotion ? fade : slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring}
                  drag={items.length > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.65}
                  onDragEnd={(_, info) => {
                    const swipe =
                      Math.abs(info.offset.x) > SWIPE_DISTANCE ||
                      Math.abs(info.velocity.x) > SWIPE_VELOCITY;
                    if (!swipe) return;
                    const goingLeft = info.offset.x < 0 || info.velocity.x < 0;
                    onStep(goingLeft ? 1 : -1);
                  }}
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                >
                  <ItemVisual item={item} sectionKey={section} />
                </motion.div>
              )}
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <CarouselArrow dir={-1} label={`Previous ${label.toLowerCase()}`} onClick={() => onStep(-1)} />
                <CarouselArrow dir={1} label={`Next ${label.toLowerCase()}`} onClick={() => onStep(1)} />
              </>
            )}
          </div>

          {item && (
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.brand && (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.brand}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={isFavorite(item) ? "Unfavorite" : "Favorite"}
                onClick={() => onToggleFavorite(item)}
                className="shrink-0 rounded-full bg-background/80 p-2 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95"
              >
                <Heart
                  className={cn(
                    "size-4 transition-colors",
                    isFavorite(item)
                      ? "fill-rose-500 text-rose-500"
                      : "text-muted-foreground",
                  )}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CarouselArrow({
  dir,
  label,
  onClick,
}: {
  dir: 1 | -1;
  label: string;
  onClick: () => void;
}) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/60 bg-background/75 p-2 text-muted-foreground shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:text-foreground active:scale-95 sm:opacity-0 sm:group-hover/section:opacity-100 sm:focus-visible:opacity-100",
        dir === 1 ? "right-2.5" : "left-2.5",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function ItemVisual({
  item,
  sectionKey,
}: {
  item: ItemWithRelations;
  sectionKey: SectionKey;
}) {
  const [loaded, setLoaded] = useState(false);
  const cover = coverOf(item);

  if (!cover) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-medium text-muted-foreground/60">
        No photo
      </div>
    );
  }

  return (
    <div className="relative h-full p-4">
      {!loaded && (
        <Skeleton className="absolute inset-4 rounded-2xl" />
      )}
      <Image
        src={imageUrl(cover.path)}
        alt={item.name}
        fill
        priority={sectionKey === "top"}
        draggable={false}
        sizes="(max-width: 640px) 90vw, 480px"
        className={cn(
          "select-none object-contain p-3 transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
