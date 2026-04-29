import { useState, useEffect } from "react";

export interface DebugStat {
  label: string;
  value: string | number;
}

interface DebugOverlayProps {
  fpsRef: React.MutableRefObject<number>;
  stats?: DebugStat[];
  onReload: () => void;
  loadTimeMs: number | null;
}

export function DebugOverlay({ fpsRef, stats = [], onReload, loadTimeMs }: DebugOverlayProps) {
  const [open, setOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [cpuCores] = useState(() => navigator.hardwareConcurrency ?? "—");

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setFps(Math.round(fpsRef.current)), 500);
    return () => clearInterval(id);
  }, [open, fpsRef]);

  const fpsColor =
    fps === 0 ? "text-[#999]" :
    fps < 30  ? "text-red-500" :
    fps < 50  ? "text-amber-600" :
                "text-emerald-600";

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-none select-none">
      {open && (
        <div className="pointer-events-auto bg-[#e8e4de]/60 backdrop-blur-md border border-[#c8c4bc] rounded-lg p-3 w-52 font-mono text-[0.6rem] tracking-[0.1em] text-[#555550] flex flex-col gap-[6px]">

          {/* FPS */}
          <Row label="FPS">
            <span className={fpsColor}>{fps || "—"}</span>
          </Row>

          {/* CPU */}
          <Row label="CPU CORES">
            <span>{cpuCores}</span>
          </Row>

          {/* Custom per-section stats */}
          {stats.map((s) => (
            <Row key={s.label} label={s.label}>
              <span>{s.value}</span>
            </Row>
          ))}

          {/* Load time */}
          <Row label="LOAD TIME">
            <span>{loadTimeMs !== null ? `${loadTimeMs.toFixed(0)} ms` : "—"}</span>
          </Row>

          {/* Divider + reload */}
          <div className="border-t border-[#c8c4bc] mt-1 pt-2">
            <button
              className="w-full text-left uppercase tracking-[0.2em] text-[#bbb] hover:text-[#111] transition-colors"
              onClick={onReload}
            >
              ↺  reload section
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        className="pointer-events-auto font-mono text-[0.55rem] tracking-[0.2em] uppercase px-2 py-1 border border-[#c8c4bc]/50 bg-[#e8e4de]/70 backdrop-blur-sm text-[#999990] hover:text-[#111] hover:border-[#999] transition-colors rounded-sm"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕ sys" : "⌥ sys"}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#aaa8a4]">{label}</span>
      <span className="text-right text-[#111]">{children}</span>
    </div>
  );
}
