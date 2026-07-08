import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSettings } from "./SettingsContext";

// ── Inside-canvas reporter ──────────────────────────────────────────────────
// Drop one of these inside every <Canvas>. It feeds the active-canvas FPS and
// the detected GPU name back into the global settings context so the site-wide
// sys overlay can display them. On unmount it resets FPS to 0.
export function CanvasStatsReporter() {
  const { fpsRef, setGpu } = useSettings();
  const { gl } = useThree();
  const frames = useRef(0);
  const last = useRef(performance.now());

  useEffect(() => {
    const ctx = gl.getContext() as WebGLRenderingContext;
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    const name = ext
      ? (ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string).replace(/\(.*?\)/g, "").trim()
      : "Unknown GPU";
    setGpu(name);
  }, [gl, setGpu]);

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const elapsed = now - last.current;
    if (elapsed >= 500) {
      fpsRef.current = (frames.current / elapsed) * 1000;
      frames.current = 0;
      last.current = now;
    }
  });

  useEffect(() => {
    const ref = fpsRef;
    return () => {
      ref.current = 0;
    };
  }, [fpsRef]);

  return null;
}

// ── Site-wide sys overlay ────────────────────────────────────────────────────
// Rendered once in the Layout. Visibility is driven by the nav "sys" toggle.
export function GlobalStatsOverlay() {
  const { showStats, fpsRef, gpu, quality } = useSettings();
  const [fps, setFps] = useState(0);
  const [cpuCores] = useState<string | number>(() => navigator.hardwareConcurrency ?? "—");

  useEffect(() => {
    if (!showStats) return;
    setFps(Math.round(fpsRef.current));
    const id = setInterval(() => setFps(Math.round(fpsRef.current)), 500);
    return () => clearInterval(id);
  }, [showStats, fpsRef]);

  if (!showStats) return null;

  const fpsColor =
    fps === 0 ? "text-[#999]" :
    fps < 30  ? "text-red-500" :
    fps < 50  ? "text-amber-600" :
                "text-emerald-600";

  return (
    <div className="fixed bottom-3 right-3 z-[60] pointer-events-none select-none">
      <div className="pointer-events-auto bg-[#e8e4de]/60 backdrop-blur-md border border-[#c8c4bc] rounded-lg p-3 w-52 font-mono text-[0.6rem] tracking-[0.1em] text-[#555550] flex flex-col gap-[6px]">
        <Row label="FPS">
          <span className={fpsColor}>{fps || "—"}</span>
        </Row>
        <Row label="MODE">
          <span className="uppercase">{quality === "high" ? "quality" : "performance"}</span>
        </Row>
        <Row label="CPU CORES">
          <span>{cpuCores}</span>
        </Row>
        <Row label="GPU">
          <span className="text-right break-words">{gpu ?? "—"}</span>
        </Row>
      </div>
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
