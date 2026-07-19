import { useLayoutEffect, useRef } from "react";

interface CanvasLine {
  /** Text drawn as pixels — not present in the DOM. */
  text: string;
  bold?: boolean;
  /** Reversed href (e.g. reverse of "mailto:foo@bar.com"). Decoded on click so
   *  the raw address never sits in an HTML attribute or as a mailto: pattern. */
  reversedHref?: string;
}

const TEXT_COLOR = "#111111";
const MUTED_COLOR = "#777777";
const FONT_SIZE = 13.44; // matches text-[0.84rem]
const LINE_HEIGHT = FONT_SIZE * 1.85;
const FONT_FAMILY = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Reverse a string — used to obfuscate hrefs so mailto:/tel: patterns
 *  don't appear verbatim in the JS bundle. */
const rev = (s: string) => s.split("").reverse().join("");

export { rev };

export default function CanvasText({
  lines,
  inline = false,
  className,
}: {
  lines: CanvasLine[];
  inline?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<{ y: number; h: number; href: string }[]>([]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const font = (bold: boolean) => `${bold ? "700" : "400"} ${FONT_SIZE}px ${FONT_FAMILY}`;

    let maxWidth = 0;
    for (const line of lines) {
      ctx.font = font(line.bold ?? false);
      const w = ctx.measureText(line.text).width;
      if (w > maxWidth) maxWidth = w;
    }

    const height = lines.length * LINE_HEIGHT;
    canvas.width = Math.ceil(maxWidth * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${Math.ceil(maxWidth)}px`;
    canvas.style.height = `${Math.ceil(height)}px`;

    // Setting width/height resets context state — re-apply
    ctx.scale(dpr, dpr);
    ctx.textBaseline = "top";

    zonesRef.current = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = i * LINE_HEIGHT;
      ctx.font = font(line.bold ?? false);
      ctx.fillStyle = line.bold ? TEXT_COLOR : MUTED_COLOR;
      ctx.fillText(line.text, 0, y);
      if (line.reversedHref) {
        zonesRef.current.push({ y, h: LINE_HEIGHT, href: rev(line.reversedHref) });
      }
    }
  }, [lines]);

  const zoneAt = (clientY: number, rect: DOMRect) => {
    const y = clientY - rect.top;
    return zonesRef.current.find((z) => y >= z.y && y < z.y + z.h);
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={inline ? { display: "inline-block", verticalAlign: "middle" } : undefined}
      role="img"
      aria-label={lines.map((l) => l.text).join("\n")}
      onClick={(e) => {
        const z = zoneAt(e.clientY, e.currentTarget.getBoundingClientRect());
        if (z) window.location.href = z.href;
      }}
      onMouseMove={(e) => {
        const z = zoneAt(e.clientY, e.currentTarget.getBoundingClientRect());
        e.currentTarget.style.cursor = z ? "pointer" : "default";
      }}
    />
  );
}
