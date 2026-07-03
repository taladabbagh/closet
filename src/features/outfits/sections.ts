import type { Category, ItemWithRelations } from "@/types";

// The builder is a fixed three-section rail: top / bottom / shoes.
export const SECTIONS = ["top", "bottom", "shoes"] as const;
export type SectionKey = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
};

const SHOES_WORDS = [
  "shoe",
  "sneaker",
  "boot",
  "heel",
  "sandal",
  "footwear",
  "loafer",
  "trainer",
  "slipper",
  "mule",
  "pump",
  "oxford",
  "derby",
  "espadrille",
  "slide",
  "flip flop",
  "flip-flop",
  "moccasin",
  "cleat",
];

const BOTTOM_WORDS = [
  "bottom",
  "pant",
  "jean",
  "trouser",
  "short",
  "skirt",
  "legging",
  "chino",
  "jogger",
  "sweatpant",
  "culotte",
  "cargo",
  "slack",
  "denim",
];

// Items that belong to none of the three rails (accessories etc.) are
// left out of the builder entirely.
const EXCLUDED_WORDS = [
  "accessor",
  "bag",
  "purse",
  "backpack",
  "hat",
  "cap",
  "beanie",
  "scarf",
  "belt",
  "glove",
  "sock",
  "jewel",
  "necklace",
  "bracelet",
  "earring",
  "ring",
  "watch",
  "sunglass",
  "glasses",
  "tie",
  "wallet",
];

// Prefix match on word boundaries so "pant" hits "pants" but "ring"
// does not hit "spring".
const toMatcher = (words: string[]) => new RegExp(`\\b(?:${words.join("|")})`);
const SHOES_RE = toMatcher(SHOES_WORDS);
const BOTTOM_RE = toMatcher(BOTTOM_WORDS);
const EXCLUDED_RE = toMatcher(EXCLUDED_WORDS);

/**
 * Classifies an item into a builder section using its category name,
 * ancestor category names, then the item name as a fallback signal.
 * Anything not recognized as bottoms/shoes/accessories lands in "top",
 * so every wearable piece stays browsable.
 */
export function classifyItem(
  item: ItemWithRelations,
  categoriesById: Map<string, Category>,
): SectionKey | null {
  const texts: string[] = [];
  let cursor = item.category_id
    ? categoriesById.get(item.category_id)
    : undefined;
  for (let depth = 0; cursor && depth < 8; depth++) {
    texts.push(cursor.name.toLowerCase());
    cursor = cursor.parent_id ? categoriesById.get(cursor.parent_id) : undefined;
  }
  texts.push(item.name.toLowerCase());

  for (const text of texts) {
    if (SHOES_RE.test(text)) return "shoes";
    if (BOTTOM_RE.test(text)) return "bottom";
    if (EXCLUDED_RE.test(text)) return null;
  }
  return "top";
}

export type SectionItems = Record<SectionKey, ItemWithRelations[]>;

export function groupBySection(
  items: ItemWithRelations[],
  categories: Category[],
): SectionItems {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups: SectionItems = { top: [], bottom: [], shoes: [] };
  for (const item of items) {
    const section = classifyItem(item, byId);
    if (section) groups[section].push(item);
  }
  return groups;
}
