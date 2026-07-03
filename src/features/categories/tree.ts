import type { Category, CategoryNode } from "@/types";

/** Builds a nested tree from a flat category list, ordered by position/name. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of categories) nodes.set(c.id, { ...c, children: [] });

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (list: CategoryNode[]) => {
    list.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Flattens a tree into (node, depth) rows for indented rendering. */
export function flattenTree(
  tree: CategoryNode[],
  depth = 0,
): { node: CategoryNode; depth: number }[] {
  return tree.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

/** Ids of a node and all of its descendants. */
export function subtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)];
}
