export default function StyleguidePage() {
  const colors = [
    { name: "Background", hex: "#f0ede8", css: "--color-bg" },
    { name: "Surface", hex: "#e8e4de", css: "--color-surface" },
    { name: "Border", hex: "#c8c4bc", css: "--color-border" },
    { name: "Text", hex: "#111111", css: "--color-text", dark: true },
    { name: "Muted", hex: "#777770", css: "--color-text-muted", dark: true },
    { name: "Accent", hex: "#E8FF00", css: "--color-accent" },
  ];

  return (
    <div className="mx-auto max-w-4xl pt-24" style={{ padding: "5rem 3rem", paddingTop: "8rem" }}>
      {/* Header */}
      <section className="mb-16">
        <p className="section-label mb-3">Design System</p>
        <h1 style={{ fontSize: "2.5rem", color: "#111111" }}>
          Styleguide
        </h1>
        <p style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.08em", color: "#777770", marginTop: "0.75rem", maxWidth: 500 }}>
          Visuelle Referenz für Farben, Typografie und UI-Komponenten in LAYER_3.
        </p>
      </section>

      {/* ── Colors ───────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Farbpalette</p>
        <div className="panel-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {colors.map((c, i) => (
            <div
              key={c.name}
              className={`overflow-hidden ${["notch-tl", "notch-tr", "notch-br", "notch-bl", "notch-tl", "notch-tr"][i]}`}
              style={{ background: "#e8e4de" }}
            >
              <div
                className="h-16"
                style={{ background: c.hex, border: c.hex === "#f0ede8" ? "1px solid #c8c4bc" : "none" }}
              />
              <div className="px-3 py-2.5">
                <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#111111" }}>{c.name}</p>
                <p style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#777770", marginTop: "2px" }}>{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Typography ───────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Typografie</p>
        <div className="notch-all-lg" style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "2rem" }}>
          <div className="mb-6">
            <p style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#777770", marginBottom: "0.5rem" }}>HEADLINE FONT</p>
            <p style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "1.5rem", color: "#111111" }}>Doto — Headlines Only</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", marginTop: "0.5rem" }}>font-family: 'Doto', monospace; font-weight: 700;</p>
          </div>
          <div style={{ height: 1, background: "#c8c4bc", margin: "1.5rem 0" }} />
          <div className="mb-6">
            <p style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#777770", marginBottom: "0.5rem" }}>BODY FONT</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "#111111" }}>monospace — Body &amp; UI Labels</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", marginTop: "0.5rem" }}>font-family: monospace; font-size: 0.8rem; letter-spacing: 0.08em;</p>
          </div>
          <div style={{ height: 1, background: "#c8c4bc", margin: "1.5rem 0" }} />
          <div className="space-y-3">
            <p style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#777770", marginBottom: "0.5rem" }}>SKALA</p>
            <h1 style={{ fontSize: "2.5rem" }}>Heading 1 — Doto 700</h1>
            <h2 style={{ fontSize: "2rem" }}>Heading 2 — Doto 700</h2>
            <h3 style={{ fontSize: "1.25rem" }}>Heading 3 — Doto 700</h3>
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#111111" }}>Body — monospace 0.8rem</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770" }}>Muted — monospace 0.75rem</p>
            <p className="stat-number">1234</p>
            <p className="stat-label">stat label</p>
          </div>
        </div>
      </section>

      {/* ── Buttons ──────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Buttons</p>
        <div className="notch-all" style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "2rem" }}>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn-primary">Primary</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-primary" style={{ opacity: 0.4, cursor: "not-allowed" }}>Disabled</button>
          </div>
          <div style={{ height: 1, background: "#c8c4bc", margin: "1.5rem 0" }} />
          <div className="space-y-2" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
            <p><span style={{ color: "#111111" }}>Primary</span> <span style={{ color: "#777770" }}>— bg: #111, color: #E8FF00, clip-path notch 10px, hover inverts</span></p>
            <p><span style={{ color: "#111111" }}>Secondary</span> <span style={{ color: "#777770" }}>— border: #111, transparent bg, clip-path TL+BR notch</span></p>
          </div>
        </div>
      </section>

      {/* ── Cards & Notches ──────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Cards &amp; Notches</p>
        <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="notch-tl p-5" style={{ background: "#e8e4de" }}>
            <h3 style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#111111", marginBottom: "0.5rem" }}>notch-tl</h3>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", lineHeight: 1.7 }}>
              Top-left corner notched. Panel grid with 1px gap creates border effect.
            </p>
          </div>
          <div className="notch-tr p-5" style={{ background: "#e8e4de" }}>
            <h3 style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#111111", marginBottom: "0.5rem" }}>notch-tr</h3>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", lineHeight: 1.7 }}>
              Top-right corner notched. Hover adds yellow top-border accent.
            </p>
          </div>
          <div className="notch-br p-5" style={{ background: "#e8e4de" }}>
            <h3 style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#111111", marginBottom: "0.5rem" }}>notch-br</h3>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", lineHeight: 1.7 }}>
              Bottom-right corner notched. No border-radius anywhere.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="notch-all-lg p-6" style={{ background: "#e8e4de", border: "1px solid #c8c4bc" }}>
            <h3 style={{ fontFamily: "'Doto', monospace", fontWeight: 700, fontSize: "0.9rem", color: "#111111", marginBottom: "0.5rem" }}>notch-all-lg (24px)</h3>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", lineHeight: 1.7 }}>
              All 4 corners notched at 24px. Used for larger sections and feature containers.
            </p>
          </div>
        </div>
      </section>

      {/* ── Tags ─────────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Tags &amp; Badges</p>
        <div className="notch-all" style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "2rem" }}>
          <div className="flex flex-wrap gap-2">
            <span className="tag">Physik</span>
            <span className="tag">@react-three/fiber</span>
            <span className="tag">Scroll</span>
            <span className="tag">Animation</span>
          </div>
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", marginTop: "1rem" }}>
            Monospaced uppercase tags with notched corners. Neutral border, light background.
          </p>
        </div>
      </section>

      {/* ── Section Labels ───────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Section Labels</p>
        <div className="notch-all" style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "2rem" }}>
          <p className="section-label mb-4">Example Label</p>
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770" }}>
            Small all-caps labels flanked by 30px lines. Used above headings to categorize sections.
          </p>
        </div>
      </section>

      {/* ── HUD Corners ──────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">HUD Corner Brackets</p>
        <div
          className="hud-corners notch-all-lg"
          style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "4rem", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777770", textAlign: "center" }}>
            Decorative L-shaped corner brackets at 4 corners.<br />
            Used on hero &amp; full-width feature sections.<br />
            Color: #E8FF00 (Neon Yellow accent)
          </p>
        </div>
      </section>

      {/* ── Spacing ──────────────────────────── */}
      <section className="pb-20 mb-8">
        <p className="section-label mb-6">Spacing System</p>
        <div className="notch-all" style={{ background: "#e8e4de", border: "1px solid #c8c4bc", padding: "2rem" }}>
          <div className="space-y-3">
            {[4, 8, 12, 16, 20, 24, 32, 40, 48].map((px) => (
              <div key={px} className="flex items-center gap-4">
                <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#777770", width: 40, textAlign: "right" }}>{px}px</span>
                <div
                  style={{
                    width: px * 3,
                    height: 12,
                    background: "#E8FF00",
                    opacity: 0.4 + (px / 80),
                    clipPath: "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
