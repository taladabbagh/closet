import { create } from "zustand";
import { SECTIONS, type SectionKey } from "./sections";

/** Current item index per section, -1 when the section has no items. */
export type Selection = Record<SectionKey, number>;

const HISTORY_LIMIT = 100;

interface OutfitStudioState {
  outfitId: string | null;
  name: string;
  notes: string;
  isFavorite: boolean;

  counts: Record<SectionKey, number>;
  selection: Selection;
  /** Last movement per section — drives the slide animation direction. */
  direction: Record<SectionKey, 1 | -1>;
  activeSection: SectionKey;

  history: Selection[];
  historyIndex: number;

  init: (state: {
    outfitId: string | null;
    name: string;
    notes: string;
    isFavorite: boolean;
    counts: Record<SectionKey, number>;
    selection: Selection;
  }) => void;
  /**
   * Refreshed server data can change section sizes without the user doing
   * anything — keep their picks and just clamp indices into range.
   */
  syncCounts: (counts: Record<SectionKey, number>) => void;
  setName: (name: string) => void;
  setNotes: (notes: string) => void;
  setFavorite: (v: boolean) => void;
  setActiveSection: (section: SectionKey) => void;
  step: (section: SectionKey, dir: 1 | -1) => void;
  select: (section: SectionKey, index: number) => void;
  randomize: () => void;
  undo: () => void;
  redo: () => void;
}

export const useOutfitStudio = create<OutfitStudioState>((set) => {
  /** Records a new selection and truncates any redo tail. */
  const commit = (
    s: OutfitStudioState,
    selection: Selection,
    direction: Partial<Record<SectionKey, 1 | -1>>,
  ) => {
    const history = [
      ...s.history.slice(0, s.historyIndex + 1),
      selection,
    ].slice(-HISTORY_LIMIT);
    return {
      selection,
      direction: { ...s.direction, ...direction },
      history,
      historyIndex: history.length - 1,
    };
  };

  /** Direction of travel for sections that changed between two selections. */
  const diffDirections = (from: Selection, to: Selection) => {
    const dir: Partial<Record<SectionKey, 1 | -1>> = {};
    for (const key of SECTIONS) {
      if (from[key] !== to[key]) dir[key] = to[key] > from[key] ? 1 : -1;
    }
    return dir;
  };

  return {
    outfitId: null,
    name: "",
    notes: "",
    isFavorite: false,
    counts: { top: 0, bottom: 0, shoes: 0 },
    selection: { top: -1, bottom: -1, shoes: -1 },
    direction: { top: 1, bottom: 1, shoes: 1 },
    activeSection: "top",
    history: [],
    historyIndex: -1,

    init: ({ outfitId, name, notes, isFavorite, counts, selection }) =>
      set({
        outfitId,
        name,
        notes,
        isFavorite,
        counts,
        selection,
        direction: { top: 1, bottom: 1, shoes: 1 },
        activeSection: "top",
        history: [selection],
        historyIndex: 0,
      }),

    syncCounts: (counts) =>
      set((s) => {
        const selection = { ...s.selection };
        for (const key of SECTIONS) {
          if (counts[key] === 0) selection[key] = -1;
          else if (selection[key] < 0) selection[key] = 0;
          else selection[key] = Math.min(selection[key], counts[key] - 1);
        }
        return { counts, selection };
      }),

    setName: (name) => set({ name }),
    setNotes: (notes) => set({ notes }),
    setFavorite: (isFavorite) => set({ isFavorite }),
    setActiveSection: (activeSection) => set({ activeSection }),

    step: (section, dir) =>
      set((s) => {
        const count = s.counts[section];
        if (count < 2) return { activeSection: section };
        const index = (s.selection[section] + dir + count) % count;
        return {
          activeSection: section,
          ...commit(s, { ...s.selection, [section]: index }, { [section]: dir }),
        };
      }),

    select: (section, index) =>
      set((s) => {
        if (index === s.selection[section]) return {};
        const dir = index > s.selection[section] ? 1 : -1;
        return commit(
          s,
          { ...s.selection, [section]: index },
          { [section]: dir },
        );
      }),

    randomize: () =>
      set((s) => {
        const next = { ...s.selection };
        for (const key of SECTIONS) {
          const count = s.counts[key];
          if (count < 2) continue;
          // always land somewhere new
          let index = Math.floor(Math.random() * (count - 1));
          if (index >= s.selection[key]) index += 1;
          next[key] = index;
        }
        return commit(s, next, diffDirections(s.selection, next));
      }),

    undo: () =>
      set((s) => {
        if (s.historyIndex <= 0) return {};
        const selection = s.history[s.historyIndex - 1];
        return {
          selection,
          direction: { ...s.direction, ...diffDirections(s.selection, selection) },
          historyIndex: s.historyIndex - 1,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.historyIndex >= s.history.length - 1) return {};
        const selection = s.history[s.historyIndex + 1];
        return {
          selection,
          direction: { ...s.direction, ...diffDirections(s.selection, selection) },
          historyIndex: s.historyIndex + 1,
        };
      }),
  };
});
