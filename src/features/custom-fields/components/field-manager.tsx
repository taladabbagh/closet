"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { CustomField, CustomFieldType } from "@/types";
import { CUSTOM_FIELD_TYPES } from "@/types";
import {
  createCustomField,
  deleteCustomField,
  updateCustomField,
} from "@/features/custom-fields/actions";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  BOOLEAN: "Yes / No",
  SELECT: "Dropdown",
  MULTI_SELECT: "Multi-select",
};

export function FieldManager({ fields }: { fields: CustomField[] }) {
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<CustomField | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define your own attributes — “Formal level”, “Comfort rating”,
          “Vacation”… They appear on every item and become filters.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center">
          <SlidersHorizontal className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No custom fields yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to start tracking what matters to you.
            </p>
          </div>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          {fields.map((f) => (
            <li
              key={f.id}
              className="group flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name}</p>
                {f.options.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {f.options.join(" · ")}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {TYPE_LABELS[f.type]}
              </Badge>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${f.name}`}
                  onClick={() => setEditing(f)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${f.name}`}
                  onClick={() => setToDelete(f)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <FieldDialog
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              All values stored for this field on your items will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!toDelete) return;
                  const res = await deleteCustomField(toDelete.id);
                  if (res.error) toast.error(res.error);
                  else toast.success("Field deleted");
                  setToDelete(null);
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldDialog({
  editing,
  onClose,
}: {
  editing: CustomField | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<CustomFieldType>(editing?.type ?? "TEXT");
  const [options, setOptions] = useState<string[]>(editing?.options ?? []);
  const [optionDraft, setOptionDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const needsOptions = type === "SELECT" || type === "MULTI_SELECT";

  const addOption = () => {
    const v = optionDraft.trim();
    if (v && !options.includes(v)) setOptions([...options, v]);
    setOptionDraft("");
  };

  const submit = () => {
    startTransition(async () => {
      const input = { name, type, options: needsOptions ? options : [] };
      const res = editing
        ? await updateCustomField(editing.id, input)
        : await createCustomField(input);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Field updated" : "Field created");
        onClose();
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit field" : "New custom field"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="field-name">Name</Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Comfort rating"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as CustomFieldType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsOptions && (
            <div className="space-y-2">
              <Label htmlFor="field-option">Options</Label>
              <div className="flex gap-2">
                <Input
                  id="field-option"
                  value={optionDraft}
                  onChange={(e) => setOptionDraft(e.target.value)}
                  placeholder="Type an option, press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addOption}>
                  Add
                </Button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {options.map((o) => (
                    <Badge key={o} variant="secondary" className="gap-1">
                      {o}
                      <button
                        type="button"
                        aria-label={`Remove ${o}`}
                        onClick={() =>
                          setOptions(options.filter((x) => x !== o))
                        }
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !name.trim() || (needsOptions && !options.length)}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
