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
    <div className="mx-auto max-w-4xl px-12 pt-32 pb-20">
      {/* Header */}
      <section className="mb-16">
        <p className="section-label mb-3">Design System</p>
        <h1 className="text-title">Styleguide</h1>
        <p className="font-mono text-body text-text-muted mt-3 max-w-[500px]">
          Visual reference for colors, typography and UI components in LAYER_3.
        </p>
      </section>

      {/* ── Colors ───────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Color Palette</p>
        <div className="panel-grid grid grid-cols-3">
          {colors.map((c, i) => (
            <div
              key={c.name}
              className={`overflow-hidden bg-surface ${["notch-tl", "notch-tr", "notch-br", "notch-bl", "notch-tl", "notch-tr"][i]}`}
            >
              <div
                className="h-16"
                style={{ background: c.hex, border: c.hex === "#f0ede8" ? "1px solid #c8c4bc" : "none" }}
              />
              <div className="px-3 py-2.5">
            <p className="font-mono text-body">{c.name}</p>
                <p className="font-mono text-micro text-text-muted mt-0.5">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Typography ───────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Typography</p>
        <div className="notch-tl-xl bg-surface p-8">
          <div className="mb-6">
            <p className="font-mono text-micro text-text-muted mb-2">HEADLINE FONT</p>
            <p className="font-doto text-subhead">Doto — Headlines Only</p>
            <p className="font-mono text-small text-text-muted mt-2">font-family: 'Doto', monospace; font-weight: 700;</p>
          </div>
          <div className="h-px bg-border my-6" />
          <div className="mb-6">
            <p className="font-mono text-micro text-text-muted mb-2">BODY FONT</p>
            <p className="font-mono text-body">monospace — Body &amp; UI Labels</p>
            <p className="font-mono text-small text-text-muted mt-2">font-family: monospace; font-size: 0.8rem; letter-spacing: 0.08em;</p>
          </div>
          <div className="h-px bg-border my-6" />
          <div className="space-y-3">
            <p className="font-mono text-micro text-text-muted mb-2">SCALE</p>
            <h1 className="text-title">Heading 1 — Doto 700</h1>
            <h2 className="text-heading">Heading 2 — Doto 700</h2>
            <h3 className="text-subhead">Heading 3 — Doto 700</h3>
            <p className="font-mono text-body">Body — monospace 0.8rem</p>
            <p className="font-mono text-small text-text-muted">Muted — monospace 0.75rem</p>
            <p className="stat-number">1234</p>
            <p className="stat-label">stat label</p>
          </div>
        </div>
      </section>

      {/* ── Buttons ──────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Buttons</p>
        <div className="notch-tr-xl bg-surface p-8">
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn-primary">Primary</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-primary opacity-40 cursor-not-allowed">Disabled</button>
          </div>
          <div className="h-px bg-border my-6" />
          <div className="space-y-2 font-mono text-small">
            <p><span className="text-text">Primary</span> <span className="text-text-muted">— bg: #111, color: #E8FF00, clip-path notch 10px, hover inverts</span></p>
            <p><span className="text-text">Secondary</span> <span className="text-text-muted">— border: #111, transparent bg, clip-path TL+BR notch</span></p>
          </div>
        </div>
      </section>

      {/* ── Cards & Notches ──────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Cards &amp; Notches</p>
        <div className="panel-grid grid grid-cols-3">
          <div className="notch-tl p-5 bg-surface">
            <h3 className="font-doto text-body mb-2">notch-tl</h3>
            <p className="font-mono text-small text-text-muted">
              Top-left corner notched. Panel grid with 1px gap creates border effect.
            </p>
          </div>
          <div className="notch-tr p-5 bg-surface">
            <h3 className="font-doto text-body mb-2">notch-tr</h3>
            <p className="font-mono text-small text-text-muted">
              Top-right corner notched. Hover adds yellow top-border accent.
            </p>
          </div>
          <div className="notch-br p-5 bg-surface">
            <h3 className="font-doto text-body mb-2">notch-br</h3>
            <p className="font-mono text-small text-text-muted">
              Bottom-right corner notched. No border-radius anywhere.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="notch-tl-xl bg-surface p-6">
            <h3 className="font-doto text-body mb-2">notch-all-lg (24px)</h3>
            <p className="font-mono text-small text-text-muted">
              All 4 corners notched at 24px. Used for larger sections and feature containers.
            </p>
          </div>
        </div>
      </section>

      {/* ── Tags ─────────────────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Tags &amp; Badges</p>
        <div className="notch-tl-xl bg-surface p-8">
          <div className="flex flex-wrap gap-2">
            <span className="tag">Physics</span>
            <span className="tag">@react-three/fiber</span>
            <span className="tag">Scroll</span>
            <span className="tag">Animation</span>
          </div>
          <p className="font-mono text-small text-text-muted mt-4">
            Monospaced uppercase tags with notched corners. Neutral border, light background.
          </p>
        </div>
      </section>

      {/* ── Section Labels ───────────────────── */}
      <section className="mb-16">
        <p className="section-label mb-6">Section Labels</p>
        <div className="notch-tr-xl bg-surface p-8">
          <p className="section-label mb-4">Example Label</p>
          <p className="font-mono text-small text-text-muted">
            Small all-caps labels flanked by 30px lines. Used above headings to categorize sections.
          </p>
        </div>
      </section>

      {/* ── Spacing ──────────────────────────── */}
      <section className="pb-20 mb-8">
        <p className="section-label mb-6">Spacing System</p>
        <div className="notch-tl-xl bg-surface p-8">
          <div className="space-y-3">
            {[4, 8, 12, 16, 20, 24, 32, 40, 48].map((px) => (
              <div key={px} className="flex items-center gap-4">
                <span className="font-mono text-micro text-text-muted w-10 text-right">{px}px</span>
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
