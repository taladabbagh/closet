"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type {
  Category,
  CustomField,
  ItemWithRelations,
  LaundryStatus,
  Season,
} from "@/types";
import { LAUNDRY_STATUSES, SEASONS } from "@/types";
import { buildCategoryTree, flattenTree } from "@/features/categories/tree";
import { createItem, updateItem } from "@/features/wardrobe/actions";
import type { ItemInput } from "@/features/wardrobe/schema";
import { ChipInput } from "@/components/chip-input";
import { MultiToggle } from "@/components/multi-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ImageUploader, type PendingImage } from "./image-uploader";

const NONE = "__none__";

export const SEASON_LABELS: Record<Season, string> = {
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
  WINTER: "Winter",
  ALL_SEASON: "All season",
};

export const LAUNDRY_LABELS: Record<LaundryStatus, string> = {
  CLEAN: "Clean",
  DIRTY: "Dirty",
  IN_LAUNDRY: "In laundry",
};

interface CustomValueDraft {
  text: string;
  number: string;
  boolean: boolean | null;
  options: string[];
}

export function ItemForm({
  userId,
  categories,
  customFields,
  facets,
  tagSuggestions,
  item,
  onSaved,
  onCancel,
}: {
  userId: string;
  categories: Category[];
  customFields: CustomField[];
  facets: {
    colors: string[];
    brands: string[];
    occasions: string[];
    styles: string[];
    materials: string[];
    fits: string[];
    patterns: string[];
  };
  tagSuggestions: string[];
  item: ItemWithRelations | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? NONE);
  const [images, setImages] = useState<PendingImage[]>(
    (item?.item_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img, i) => ({ path: img.path, position: i })),
  );
  const [colors, setColors] = useState<string[]>(item?.colors ?? []);
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? []);
  const [occasions, setOccasions] = useState<string[]>(item?.occasions ?? []);
  const [style, setStyle] = useState(item?.style ?? "");
  const [materials, setMaterials] = useState<string[]>(item?.materials ?? []);
  const [fit, setFit] = useState(item?.fit ?? "");
  const [pattern, setPattern] = useState(item?.pattern ?? "");
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [purchaseDate, setPurchaseDate] = useState(item?.purchase_date ?? "");
  const [laundry, setLaundry] = useState<LaundryStatus>(
    item?.laundry_status ?? "CLEAN",
  );
  const [favorite, setFavorite] = useState(item?.is_favorite ?? false);
  const [active, setActive] = useState(item?.is_active ?? true);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tags, setTags] = useState<string[]>(
    (item?.item_tags ?? []).map((t) => t.tags.name),
  );

  const [customValues, setCustomValues] = useState<
    Record<string, CustomValueDraft>
  >(() => {
    const initial: Record<string, CustomValueDraft> = {};
    for (const field of customFields) {
      const existing = item?.custom_field_values.find(
        (v) => v.field_id === field.id,
      );
      initial[field.id] = {
        text: existing?.value_text ?? "",
        number:
          existing?.value_number != null ? String(existing.value_number) : "",
        boolean: existing?.value_boolean ?? null,
        options: existing?.value_options ?? [],
      };
    }
    return initial;
  });

  const categoryRows = useMemo(
    () => flattenTree(buildCategoryTree(categories)),
    [categories],
  );

  const setCustom = (fieldId: string, patch: Partial<CustomValueDraft>) =>
    setCustomValues((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], ...patch },
    }));

  const submit = () => {
    const payload: ItemInput = {
      name,
      notes: notes || null,
      category_id: categoryId === NONE ? null : categoryId,
      colors,
      brand: brand || null,
      seasons,
      occasions,
      style: style || null,
      materials,
      fit: fit || null,
      pattern: pattern || null,
      price: price === "" ? null : Number(price),
      purchase_date: purchaseDate || null,
      laundry_status: laundry,
      is_favorite: favorite,
      is_active: active,
      tags,
      images,
      custom_values: customFields.map((f) => {
        const draft = customValues[f.id];
        return {
          field_id: f.id,
          value_text: f.type === "TEXT" ? draft.text || null : null,
          value_number:
            f.type === "NUMBER" && draft.number !== ""
              ? Number(draft.number)
              : null,
          value_boolean: f.type === "BOOLEAN" ? draft.boolean : null,
          value_options:
            f.type === "SELECT" || f.type === "MULTI_SELECT"
              ? draft.options
              : [],
        };
      }),
    };

    startTransition(async () => {
      const res = item
        ? await updateItem(item.id, payload)
        : await createItem(payload);
      if (res.error) toast.error(res.error);
      else {
        toast.success(item ? "Item updated" : "Item added");
        onSaved();
      }
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2">
        <Label>Photos</Label>
        <ImageUploader userId={userId} images={images} onChange={setImages} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-name">Name *</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. White linen shirt"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={categoryId}
            onValueChange={(v) => setCategoryId(v ?? NONE)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Uncategorized</SelectItem>
              {categoryRows.map(({ node, depth }) => (
                <SelectItem key={node.id} value={node.id}>
                  {"— ".repeat(depth)}
                  {node.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-colors">Colors</Label>
          <ChipInput
            id="item-colors"
            value={colors}
            onChange={setColors}
            suggestions={facets.colors}
            placeholder="e.g. white, navy…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-brand">Brand</Label>
          <Input
            id="item-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            list="brand-suggestions"
            placeholder="e.g. Uniqlo"
          />
          <datalist id="brand-suggestions">
            {facets.brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Seasons</Label>
        <MultiToggle
          options={SEASONS}
          value={seasons}
          onChange={setSeasons}
          labels={SEASON_LABELS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-occasions">Occasions</Label>
          <ChipInput
            id="item-occasions"
            value={occasions}
            onChange={setOccasions}
            suggestions={facets.occasions}
            placeholder="e.g. work, casual…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-materials">Materials</Label>
          <ChipInput
            id="item-materials"
            value={materials}
            onChange={setMaterials}
            suggestions={facets.materials}
            placeholder="e.g. cotton, wool…"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="item-style">Style</Label>
          <Input
            id="item-style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            list="style-suggestions"
            placeholder="e.g. minimal"
          />
          <datalist id="style-suggestions">
            {facets.styles.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-fit">Fit</Label>
          <Input
            id="item-fit"
            value={fit}
            onChange={(e) => setFit(e.target.value)}
            list="fit-suggestions"
            placeholder="e.g. oversized"
          />
          <datalist id="fit-suggestions">
            {facets.fits.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-pattern">Pattern</Label>
          <Input
            id="item-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            list="pattern-suggestions"
            placeholder="e.g. striped"
          />
          <datalist id="pattern-suggestions">
            {facets.patterns.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="item-price">Price</Label>
          <Input
            id="item-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item-purchased">Purchase date</Label>
          <Input
            id="item-purchased"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Laundry</Label>
          <Select
            value={laundry}
            onValueChange={(v) => setLaundry(v as LaundryStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAUNDRY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LAUNDRY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-tags">Tags</Label>
        <ChipInput
          id="item-tags"
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder="e.g. vacation, gym…"
        />
      </div>

      {customFields.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <p className="text-sm font-medium">Custom fields</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {customFields.map((field) => {
                const draft = customValues[field.id];
                return (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`cf-${field.id}`}>{field.name}</Label>
                    {field.type === "TEXT" && (
                      <Input
                        id={`cf-${field.id}`}
                        value={draft.text}
                        onChange={(e) =>
                          setCustom(field.id, { text: e.target.value })
                        }
                      />
                    )}
                    {field.type === "NUMBER" && (
                      <Input
                        id={`cf-${field.id}`}
                        type="number"
                        step="any"
                        value={draft.number}
                        onChange={(e) =>
                          setCustom(field.id, { number: e.target.value })
                        }
                      />
                    )}
                    {field.type === "BOOLEAN" && (
                      <div className="flex h-8 items-center gap-2">
                        <Checkbox
                          id={`cf-${field.id}`}
                          checked={draft.boolean === true}
                          onCheckedChange={(checked) =>
                            setCustom(field.id, {
                              boolean: checked === true ? true : null,
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          Yes
                        </span>
                      </div>
                    )}
                    {field.type === "SELECT" && (
                      <Select
                        value={draft.options[0] ?? NONE}
                        onValueChange={(v) =>
                          setCustom(field.id, {
                            options: !v || v === NONE ? [] : [v],
                          })
                        }
                      >
                        <SelectTrigger
                          id={`cf-${field.id}`}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {field.options.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === "MULTI_SELECT" && (
                      <MultiToggle
                        options={field.options}
                        value={draft.options}
                        onChange={(next) =>
                          setCustom(field.id, { options: next })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="item-notes">Notes</Label>
        <Textarea
          id="item-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything worth remembering…"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={favorite} onCheckedChange={setFavorite} />
          Favorite
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : item ? "Save changes" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
