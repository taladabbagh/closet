"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, CategoryNode } from "@/types";
import { cn } from "@/lib/utils";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/features/categories/actions";
import { buildCategoryTree, flattenTree } from "@/features/categories/tree";
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

const NO_PARENT = "__root__";

type EditorState =
  | { open: false }
  | { open: true; editing: Category | null; defaultParentId: string | null };

export function CategoryManager({ categories }: { categories: Category[] }) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [toDelete, setToDelete] = useState<CategoryNode | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      const res = await deleteCategory(toDelete.id);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted “${toDelete.name}”`);
      setToDelete(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organize your wardrobe your way — categories are fully yours, nest
          them however you like.
        </p>
        <Button
          onClick={() =>
            setEditor({ open: true, editing: null, defaultParentId: null })
          }
        >
          <Plus className="size-4" /> New category
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center">
          <FolderTree className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Start with top-level groups like “Clothing” or “Accessories”,
              then nest inside them.
            </p>
          </div>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          {rows.map(({ node, depth }) => (
            <li
              key={node.id}
              className="group flex items-center gap-2 border-b px-4 py-2.5 last:border-b-0 hover:bg-accent/40"
              style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
            >
              {depth > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              )}
              {node.color && (
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: node.color }}
                />
              )}
              <span
                className={cn(
                  "truncate text-sm",
                  depth === 0 && "font-semibold",
                )}
              >
                {node.icon ? `${node.icon} ` : ""}
                {node.name}
              </span>

              <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Add child to ${node.name}`}
                  onClick={() =>
                    setEditor({
                      open: true,
                      editing: null,
                      defaultParentId: node.id,
                    })
                  }
                >
                  <Plus className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${node.name}`}
                  onClick={() =>
                    setEditor({
                      open: true,
                      editing: node,
                      defaultParentId: node.parent_id,
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${node.name}`}
                  onClick={() => setToDelete(node)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor.open && (
        <CategoryDialog
          key={editor.editing?.id ?? editor.defaultParentId ?? "new"}
          categories={categories}
          editing={editor.editing}
          defaultParentId={editor.defaultParentId}
          onClose={() => setEditor({ open: false })}
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
              Subcategories inside it will be deleted too. Items keep existing
              but lose this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({
  categories,
  editing,
  defaultParentId,
  onClose,
}: {
  categories: Category[];
  editing: Category | null;
  defaultParentId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "");
  const [color, setColor] = useState(editing?.color ?? "");
  const [parentId, setParentId] = useState(defaultParentId ?? NO_PARENT);
  const [pending, startTransition] = useTransition();

  // A category cannot be nested under itself or its descendants.
  const invalidParents = useMemo(() => {
    if (!editing) return new Set<string>();
    const ids = new Set([editing.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of categories) {
        if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [editing, categories]);

  const submit = () => {
    startTransition(async () => {
      const input = {
        name,
        icon: icon || null,
        color: color || null,
        parent_id: parentId === NO_PARENT ? null : parentId,
      };
      const res = editing
        ? await updateCategory(editing.id, input)
        : await createCategory(input);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Category updated" : "Category created");
        onClose();
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit category" : "New category"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tops"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Parent</Label>
            <Select
              value={parentId}
              onValueChange={(v) => setParentId(v ?? NO_PARENT)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>None (top level)</SelectItem>
                {flattenTree(buildCategoryTree(categories))
                  .filter(({ node }) => !invalidParents.has(node.id))
                  .map(({ node, depth }) => (
                    <SelectItem key={node.id} value={node.id}>
                      {"— ".repeat(depth)}
                      {node.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Icon (emoji)</Label>
              <Input
                id="cat-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="👕"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick color"
                  value={color || "#a3a3a3"}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-9 cursor-pointer rounded-lg border bg-transparent p-1"
                />
                {color && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setColor("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
