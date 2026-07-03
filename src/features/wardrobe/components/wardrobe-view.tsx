"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Plus, Shirt, Trash2, WashingMachine } from "lucide-react";
import { toast } from "sonner";
import type {
  Category,
  CustomField,
  ItemWithRelations,
  LaundryStatus,
} from "@/types";
import type { Facets } from "@/features/filters/query";
import {
  deleteItem,
  markWorn,
  setLaundryStatus,
  toggleFavorite,
} from "@/features/wardrobe/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LAUNDRY_LABELS } from "./item-form";
import { ItemCard } from "./item-card";
import { ItemForm } from "./item-form";

export function WardrobeView({
  userId,
  items,
  categories,
  customFields,
  facets,
  tagSuggestions,
  hasFilters,
}: {
  userId: string;
  items: ItemWithRelations[];
  categories: Category[];
  customFields: CustomField[];
  facets: Facets;
  tagSuggestions: string[];
  hasFilters: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<ItemWithRelations | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const closeAll = () => {
    setAdding(false);
    setSelected(null);
    setConfirmDelete(false);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-24 text-center">
          <Shirt className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {hasFilters ? "Nothing matches these filters" : "Your wardrobe is empty"}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Try removing some filters."
                : "Add your first piece to get started."}
            </p>
          </div>
          {!hasFilters && (
            <Button onClick={() => setAdding(true)} variant="outline">
              <Plus className="size-4" /> Add item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onOpen={() => setSelected(item)}
              onToggleFavorite={() =>
                startTransition(async () => {
                  const res = await toggleFavorite(item.id, !item.is_favorite);
                  if (res.error) toast.error(res.error);
                })
              }
            />
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
          </DialogHeader>
          <ItemForm
            userId={userId}
            categories={categories}
            customFields={customFields}
            facets={facets}
            tagSuggestions={tagSuggestions}
            item={null}
            onSaved={closeAll}
            onCancel={closeAll}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selected.name}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await markWorn(selected.id);
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Wear logged — marked as dirty");
                        setSelected(null);
                      }
                    })
                  }
                >
                  <CalendarCheck className="size-3.5" /> Wore it today
                </Button>

                <div className="flex items-center gap-1.5">
                  <WashingMachine className="size-4 text-muted-foreground" />
                  <Select
                    value={selected.laundry_status}
                    onValueChange={(v) =>
                      startTransition(async () => {
                        const res = await setLaundryStatus(
                          selected.id,
                          v as LaundryStatus,
                        );
                        if (res.error) toast.error(res.error);
                        else setSelected(null);
                      })
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(LAUNDRY_LABELS) as LaundryStatus[]
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {LAUNDRY_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>

              <ItemForm
                userId={userId}
                categories={categories}
                customFields={customFields}
                facets={facets}
                tagSuggestions={tagSuggestions}
                item={selected}
                onSaved={closeAll}
                onCancel={closeAll}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{selected?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The item, its photos, and its outfit references will be removed
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!selected) return;
                  const res = await deleteItem(selected.id);
                  if (res.error) toast.error(res.error);
                  else toast.success("Item deleted");
                  closeAll();
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
