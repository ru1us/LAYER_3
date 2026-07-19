import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

// ── Quality mode ────────────────────────────────────────────────────────────
export type Quality = "high" | "performance";

// Per-canvas quality profile. `high` is the generic flag each canvas reads to
// decide whether to enable expensive features (shadows, env maps, sheen, the
// fish water filter, full particle counts, …). Performance mode is aggressive:
// sub-native resolution, no AA, no shadows.
export interface QualityProfile {
  high: boolean;
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
}

export function qualityProfile(q: Quality): QualityProfile {
  const high = q === "high";
  return {
    high,
    dpr: high ? [1, 1.75] : [0.6, 1],
    antialias: high,
    shadows: high,
  };
}

// Auto-detect a sensible default based on the device. Weak machines (few logical
// cores) and coarse-pointer devices (phones/tablets) default to performance.
function detectDefaultQuality(): Quality {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (cores <= 4 || coarsePointer) return "performance";
  return "high";
}

// ── Context ───────────────────────────────────────────────────────────────
interface SettingsContextValue {
  quality: Quality;
  profile: QualityProfile;
  setQuality: (q: Quality) => void;
  showStats: boolean;
  toggleStats: () => void;
  // Active-canvas FPS — whichever R3F canvas is currently rendering writes here.
  fpsRef: React.MutableRefObject<number>;
  gpu: string | null;
  setGpu: (gpu: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [quality, setQuality] = useState<Quality>(detectDefaultQuality);
  const [showStats, setShowStats] = useState(false);
  const [gpu, setGpu] = useState<string | null>(null);
  const fpsRef = useRef(0);

  const toggleStats = useCallback(() => setShowStats((s) => !s), []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      quality,
      profile: qualityProfile(quality),
      setQuality,
      showStats,
      toggleStats,
      fpsRef,
      gpu,
      setGpu,
    }),
    [quality, showStats, toggleStats, gpu],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
