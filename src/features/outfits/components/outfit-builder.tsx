"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Redo2, Shuffle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, ItemWithRelations, OutfitWithItems } from "@/types";
import { cn } from "@/lib/utils";
import { toggleFavorite } from "@/features/wardrobe/actions";
import { saveOutfit } from "@/features/outfits/actions";
import {
  SECTIONS,
  SECTION_LABELS,
  groupBySection,
} from "@/features/outfits/sections";
import { useOutfitStudio, type Selection } from "@/features/outfits/store";
import { SectionCarousel } from "@/features/outfits/components/section-carousel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable);

export function OutfitBuilder({
  outfit,
  items,
  categories,
}: {
  outfit: OutfitWithItems | null;
  items: ItemWithRelations[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saveOpen, setSaveOpen] = useState(false);
  // optimistic per-item favorite state, layered over server data
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => groupBySection(items, categories),
    [items, categories],
  );

  const {
    outfitId,
    name,
    notes,
    isFavorite,
    selection,
    direction,
    activeSection,
    history,
    historyIndex,
    init,
    syncCounts,
    setName,
    setNotes,
    setFavorite,
    setActiveSection,
    step,
    randomize,
    undo,
    redo,
  } = useOutfitStudio();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // seed the store from server data — once per outfit; later data refreshes
  // (e.g. after toggling a favorite) must not reset the user's picks
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    const seedKey = outfit?.id ?? "new";
    const counts = {
      top: groups.top.length,
      bottom: groups.bottom.length,
      shoes: groups.shoes.length,
    };
    if (seededFor.current === seedKey) {
      syncCounts(counts);
      return;
    }
    seededFor.current = seedKey;

    const selection: Selection = { top: -1, bottom: -1, shoes: -1 };
    for (const key of SECTIONS) {
      if (groups[key].length > 0) selection[key] = 0;
    }
    if (outfit) {
      // point each section at the saved piece, when it still exists
      for (const oi of outfit.outfit_items
        .slice()
        .sort((a, b) => a.position - b.position)) {
        for (const key of SECTIONS) {
          const idx = groups[key].findIndex((it) => it.id === oi.item_id);
          if (idx >= 0) {
            selection[key] = idx;
            break;
          }
        }
      }
    }
    init({
      outfitId: outfit?.id ?? null,
      name: outfit?.name ?? "",
      notes: outfit?.notes ?? "",
      isFavorite: outfit?.is_favorite ?? false,
      counts,
      selection,
    });
  }, [outfit, groups, init, syncCounts]);

  // global keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || isTypingTarget(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          step(activeSection, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          step(activeSection, 1);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const delta = e.key === "ArrowDown" ? 1 : -1;
          const at = SECTIONS.indexOf(activeSection);
          const next =
            SECTIONS[(at + delta + SECTIONS.length) % SECTIONS.length];
          setActiveSection(next);
          break;
        }
        case "r":
        case "R":
          randomize();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveOpen, activeSection, step, randomize, undo, redo, setActiveSection]);

  const selectedItems = SECTIONS.map((key) =>
    selection[key] >= 0 ? groups[key][selection[key]] : undefined,
  ).filter((it): it is ItemWithRelations => !!it);

  const itemIsFavorite = (item: ItemWithRelations) =>
    favOverrides[item.id] ?? item.is_favorite;

  const handleToggleItemFavorite = (item: ItemWithRelations) => {
    const next = !itemIsFavorite(item);
    setFavOverrides((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      const res = await toggleFavorite(item.id, next);
      if (res.error) {
        setFavOverrides((prev) => ({ ...prev, [item.id]: !next }));
        toast.error(res.error);
      }
    });
  };

  const save = () => {
    startTransition(async () => {
      const res = await saveOutfit(outfitId, {
        name,
        notes: notes || null,
        is_favorite: isFavorite,
        items: selectedItems.map((item, i) => ({
          item_id: item.id,
          slot_category_id: item.category_id,
          position: i,
        })),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(outfitId ? "Outfit updated" : "Outfit saved");
        setSaveOpen(false);
        router.push("/outfits");
        router.refresh();
      }
    });
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl flex-col">
      {/* soft ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-80 max-w-lg rounded-full bg-gradient-to-br from-rose-200/40 via-violet-200/30 to-sky-200/40 blur-3xl dark:from-rose-500/10 dark:via-violet-500/10 dark:to-sky-500/10"
      />

      <header className="mb-5 flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {outfitId ? "Edit outfit" : "Outfit builder"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Swipe, tap the arrows, or use ← → to mix &amp; match.
          </p>
        </div>
        <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <Kbd>↑↓</Kbd> section <Kbd>←→</Kbd> browse <Kbd>R</Kbd> shuffle
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {SECTIONS.map((key) => (
          <SectionCarousel
            key={key}
            section={key}
            label={SECTION_LABELS[key]}
            items={groups[key]}
            index={selection[key]}
            direction={direction[key]}
            active={activeSection === key}
            isFavorite={itemIsFavorite}
            onStep={(dir) => step(key, dir)}
            onActivate={() => setActiveSection(key)}
            onToggleFavorite={handleToggleItemFavorite}
          />
        ))}
      </div>

      {/* floating action bar — sits above the mobile tab bar */}
      <div className="pointer-events-none sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-6 flex justify-center md:bottom-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-background/75 p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.3)] backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            className="rounded-full"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuffle outfit"
            className="rounded-full"
            disabled={selectedItems.length === 0}
            onClick={randomize}
          >
            <Shuffle className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            className="rounded-full"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 !h-5" />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Favorite outfit"
            className="rounded-full"
            onClick={() => setFavorite(!isFavorite)}
          >
            <Heart
              className={cn(
                "size-4",
                isFavorite && "fill-rose-500 text-rose-500",
              )}
            />
          </Button>
          <Button
            className="rounded-full px-4"
            disabled={selectedItems.length === 0 || pending}
            onClick={() => setSaveOpen(true)}
          >
            {outfitId ? "Update outfit" : "Save outfit"}
          </Button>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{outfitId ? "Update outfit" : "Save outfit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outfit-name">Name *</Label>
              <Input
                id="outfit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Friday casual"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim() && !pending) save();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outfit-notes">Notes</Label>
              <Textarea
                id="outfit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Occasion, weather, accessories…"
              />
            </div>
            <Button
              className="w-full"
              disabled={pending || !name.trim()}
              onClick={save}
            >
              {pending ? "Saving…" : outfitId ? "Update outfit" : "Save outfit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-foreground/80 shadow-sm">
      {children}
    </kbd>
  );
}
