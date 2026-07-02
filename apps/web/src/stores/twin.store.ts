import { create } from "zustand";

interface TwinState {
  twinData: any | null;
  selectedAsset: any | null;
  activeLayers: string[];
  setTwinData: (d: any) => void;
  setSelectedAsset: (a: any) => void;
  toggleLayer: (layer: string) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  twinData: null,
  selectedAsset: null,
  activeLayers: ["infrastructure", "risk", "incidents"],
  setTwinData: (d) => set({ twinData: d }),
  setSelectedAsset: (a) => set({ selectedAsset: a }),
  toggleLayer: (layer) => set((s) => ({
    activeLayers: s.activeLayers.includes(layer)
      ? s.activeLayers.filter((l) => l !== layer)
      : [...s.activeLayers, layer],
  })),
}));
